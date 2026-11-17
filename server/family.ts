import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { familyEntries, familyInvitations, familyMembers, families, users } from "../drizzle/schema";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const idInput = z.number().int().positive();
const amountInput = z.number().finite().positive().max(9999999999.99);
const emailInput = z.string().trim().email().max(320).transform((v) => v.toLowerCase());
const cleanOptional = z.string().trim().max(500).nullable().optional();
const dbRequired = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة حاليًا" });
  return db;
};
const forbidden = () => new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تنفيذ هذا الإجراء" });
const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "الأسرة أو السجل غير موجود" });

/** Every operation resolves membership and the relevant capability from the database. */
async function membership(db: Awaited<ReturnType<typeof getDb>> & {}, familyId: number, userId: number) {
  const rows = await db.select({ member: familyMembers, family: families })
    .from(familyMembers).innerJoin(families, eq(familyMembers.familyId, families.id))
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId))).limit(1);
  if (!rows.length) throw notFound();
  return { ...rows[0].member, isOwner: rows[0].family.ownerUserId === userId };
}
async function ownerOnly(db: Awaited<ReturnType<typeof getDb>> & {}, familyId: number, userId: number) {
  const [row] = await db.select({ id: families.id }).from(families)
    .where(and(eq(families.id, familyId), eq(families.ownerUserId, userId))).limit(1);
  if (!row) throw forbidden();
}
const dateInput = z.coerce.date();

export const familyRouter = router({
  create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired();
    const rows = await db.insert(families).values({ name: input.name, ownerUserId: ctx.user.id });
    const familyId = Number((rows as any)[0]?.insertId);
    if (!familyId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء دفتر الأسرة" });
    await db.insert(familyMembers).values({ familyId, userId: ctx.user.id, canView: true, canAdd: true, canEditOwn: true });
    return { familyId };
  }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const db = await dbRequired();
    return db.select({ family: families, membership: familyMembers }).from(familyMembers)
      .innerJoin(families, eq(familyMembers.familyId, families.id)).where(eq(familyMembers.userId, ctx.user.id));
  }),

  listMembers: protectedProcedure.input(z.object({ familyId: idInput })).query(async ({ ctx, input }) => {
    const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
    return db.select({ userId: familyMembers.userId, name: users.name, email: users.email,
      canView: familyMembers.canView, canAdd: familyMembers.canAdd, canEditOwn: familyMembers.canEditOwn,
      joinedAt: familyMembers.joinedAt })
      .from(familyMembers).innerJoin(users, eq(familyMembers.userId, users.id))
      .where(eq(familyMembers.familyId, input.familyId));
  }),

  listInvitations: protectedProcedure.input(z.object({ familyId: idInput })).query(async ({ ctx, input }) => {
    const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
    return db.select({ id: familyInvitations.id, email: familyInvitations.invitedEmail,
      expiresAt: familyInvitations.expiresAt, createdAt: familyInvitations.createdAt })
      .from(familyInvitations).where(and(eq(familyInvitations.familyId, input.familyId),
        isNull(familyInvitations.usedAt), isNull(familyInvitations.revokedAt), gt(familyInvitations.expiresAt, new Date())));
  }),

  createInvitation: protectedProcedure.input(z.object({ familyId: idInput, email: emailInput, expiresInHours: z.number().int().min(1).max(168).default(72) }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbRequired();
      await ownerOnly(db, input.familyId, ctx.user.id);
      if (ctx.user.email?.trim().toLowerCase() === input.email) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن دعوة بريد مالك الدفتر" });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) {
        const [member] = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, input.familyId), eq(familyMembers.userId, existing.id))).limit(1);
        if (member) throw new TRPCError({ code: "CONFLICT", message: "هذا المستخدم عضو بالفعل" });
      }
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
      await db.insert(familyInvitations).values({ familyId: input.familyId, invitedByUserId: ctx.user.id, invitedEmail: input.email, tokenHash, expiresAt });
      // Return the secret once only. Caller builds its own deep link/mailto/share message; no email is sent here.
      return { email: input.email, token: rawToken, expiresAt, familyId: input.familyId };
    }),

  acceptInvitation: protectedProcedure.input(z.object({ token: z.string().min(32).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const currentEmail = ctx.user.email?.trim().toLowerCase();
      if (!currentEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يلزم أن يكون بريد حساب Manus متاحًا لقبول الدعوة" });
      const db = await dbRequired();
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const now = new Date();
      const [invite] = await db.select().from(familyInvitations).where(and(
        eq(familyInvitations.tokenHash, tokenHash), eq(familyInvitations.invitedEmail, currentEmail),
        isNull(familyInvitations.usedAt), isNull(familyInvitations.revokedAt), gt(familyInvitations.expiresAt, now),
      )).limit(1);
      if (!invite) throw new TRPCError({ code: "BAD_REQUEST", message: "الدعوة غير صالحة أو منتهية أو لا تخص بريد حسابك" });
      await db.transaction(async (tx) => {
        const result = await tx.update(familyInvitations).set({ usedAt: now }).where(and(
          eq(familyInvitations.id, invite.id), isNull(familyInvitations.usedAt), isNull(familyInvitations.revokedAt), gt(familyInvitations.expiresAt, now),
        ));
        const affected = Number((result as any)[0]?.affectedRows ?? 0);
        if (affected !== 1) throw new TRPCError({ code: "CONFLICT", message: "سبق استخدام الدعوة أو إلغاؤها" });
        await tx.insert(familyMembers).values({ familyId: invite.familyId, userId: ctx.user.id, canView: true, canAdd: true, canEditOwn: true });
      });
      return { familyId: invite.familyId };
    }),

  revokeInvitation: protectedProcedure.input(z.object({ familyId: idInput, invitationId: idInput })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
    await db.update(familyInvitations).set({ revokedAt: new Date() }).where(and(eq(familyInvitations.id, input.invitationId), eq(familyInvitations.familyId, input.familyId), isNull(familyInvitations.usedAt), isNull(familyInvitations.revokedAt)));
    return { success: true };
  }),

  setMemberPermissions: protectedProcedure.input(z.object({ familyId: idInput, userId: idInput, canView: z.boolean(), canAdd: z.boolean(), canEditOwn: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تغيير صلاحيات المالك" });
      const [member] = await db.select({ id: familyMembers.id }).from(familyMembers)
        .where(and(eq(familyMembers.familyId, input.familyId), eq(familyMembers.userId, input.userId))).limit(1);
      if (!member) throw notFound();
      await db.update(familyMembers).set({ canView: input.canView, canAdd: input.canAdd, canEditOwn: input.canEditOwn })
        .where(eq(familyMembers.id, member.id));
      return { success: true };
    }),

  removeMember: protectedProcedure.input(z.object({ familyId: idInput, userId: idInput })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إزالة مالك الدفتر" });
    await db.delete(familyMembers).where(and(eq(familyMembers.familyId, input.familyId), eq(familyMembers.userId, input.userId)));
    return { success: true };
  }),

  listEntries: protectedProcedure.input(z.object({ familyId: idInput, limit: z.number().int().min(1).max(200).default(100), before: dateInput.optional() }))
    .query(async ({ ctx, input }) => {
      const db = await dbRequired(); const m = await membership(db, input.familyId, ctx.user.id);
      if (!m.canView && !m.isOwner) throw forbidden();
      return db.select({ entry: familyEntries, authorName: users.name }).from(familyEntries)
        .innerJoin(users, eq(familyEntries.createdByUserId, users.id))
        .where(and(eq(familyEntries.familyId, input.familyId), input.before ? lte(familyEntries.occurredAt, input.before) : undefined))
        .orderBy(familyEntries.occurredAt).limit(input.limit);
    }),

  addExpense: protectedProcedure.input(z.object({ familyId: idInput, amount: amountInput, occurredAt: dateInput, description: cleanOptional, category: z.string().trim().max(120).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbRequired(); const m = await membership(db, input.familyId, ctx.user.id);
      if (!m.canAdd && !m.isOwner) throw forbidden();
      const [r] = await db.insert(familyEntries).values({ familyId: input.familyId, createdByUserId: ctx.user.id, type: "expense", amount: input.amount.toFixed(2), occurredAt: input.occurredAt, description: input.description ?? null, category: input.category ?? null, recipientUserId: null });
      return { id: Number((r as any).insertId) };
    }),

  addAllowance: protectedProcedure.input(z.object({ familyId: idInput, recipientUserId: idInput, amount: amountInput, occurredAt: dateInput, description: cleanOptional }))
    .mutation(async ({ ctx, input }) => {
      const db = await dbRequired(); await ownerOnly(db, input.familyId, ctx.user.id);
      const [recipient] = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.familyId, input.familyId), eq(familyMembers.userId, input.recipientUserId))).limit(1);
      if (!recipient) throw new TRPCError({ code: "BAD_REQUEST", message: "مستلم المصروف يجب أن يكون عضوًا في الأسرة" });
      const [r] = await db.insert(familyEntries).values({ familyId: input.familyId, createdByUserId: ctx.user.id, type: "allowance", amount: input.amount.toFixed(2), occurredAt: input.occurredAt, description: input.description ?? null, category: null, recipientUserId: input.recipientUserId });
      return { id: Number((r as any).insertId) };
    }),

  updateEntry: protectedProcedure.input(z.object({ familyId: idInput, entryId: idInput, amount: amountInput.optional(), occurredAt: dateInput.optional(), description: cleanOptional, category: z.string().trim().max(120).nullable().optional() }).refine((v) => v.amount !== undefined || v.occurredAt !== undefined || v.description !== undefined || v.category !== undefined, "أدخل حقلًا واحدًا على الأقل للتعديل"))
    .mutation(async ({ ctx, input }) => {
      const db = await dbRequired(); const m = await membership(db, input.familyId, ctx.user.id);
      const [entry] = await db.select().from(familyEntries).where(and(eq(familyEntries.id, input.entryId), eq(familyEntries.familyId, input.familyId))).limit(1);
      if (!entry) throw notFound();
      if (!m.isOwner && (entry.type !== "expense" || !m.canEditOwn || entry.createdByUserId !== ctx.user.id)) throw forbidden();
      const patch: Record<string, unknown> = {};
      if (input.amount !== undefined) patch.amount = input.amount.toFixed(2);
      if (input.occurredAt !== undefined) patch.occurredAt = input.occurredAt;
      if (input.description !== undefined) patch.description = input.description;
      if (input.category !== undefined) patch.category = input.category;
      await db.update(familyEntries).set(patch as any).where(and(eq(familyEntries.id, input.entryId), eq(familyEntries.familyId, input.familyId)));
      return { success: true };
    }),

  deleteEntry: protectedProcedure.input(z.object({ familyId: idInput, entryId: idInput })).mutation(async ({ ctx, input }) => {
    const db = await dbRequired(); const m = await membership(db, input.familyId, ctx.user.id);
    const [entry] = await db.select().from(familyEntries).where(and(eq(familyEntries.id, input.entryId), eq(familyEntries.familyId, input.familyId))).limit(1);
    if (!entry) throw notFound();
    if (!m.isOwner && (entry.type !== "expense" || !m.canEditOwn || entry.createdByUserId !== ctx.user.id)) throw forbidden();
    await db.delete(familyEntries).where(and(eq(familyEntries.id, input.entryId), eq(familyEntries.familyId, input.familyId)));
    return { success: true };
  }),
});
