import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /** Surrogate primary key. */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Shared family notebook metadata; personal/local notebook data is deliberately absent. */
export const families = mysqlTable("families", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  ownerUserId: int("ownerUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("families_owner_idx").on(t.ownerUserId)]);

export const familyMembers = mysqlTable("family_members", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id),
  canView: boolean("canView").default(true).notNull(),
  canAdd: boolean("canAdd").default(true).notNull(),
  canEditOwn: boolean("canEditOwn").default(true).notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("family_members_family_user_uq").on(t.familyId, t.userId), index("family_members_user_idx").on(t.userId)]);

export const familyInvitations = mysqlTable("family_invitations", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id, { onDelete: "cascade" }),
  invitedByUserId: int("invitedByUserId").notNull().references(() => users.id),
  invitedEmail: varchar("invitedEmail", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("family_invites_family_idx").on(t.familyId), index("family_invites_email_idx").on(t.invitedEmail)]);

/** Entry types are intentionally disjoint: allowances are not purchases/expenses. */
export const familyEntries = mysqlTable("family_entries", {
  id: int("id").autoincrement().primaryKey(),
  familyId: int("familyId").notNull().references(() => families.id, { onDelete: "cascade" }),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  type: mysqlEnum("type", ["expense", "allowance"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  description: varchar("description", { length: 500 }),
  category: varchar("category", { length: 120 }),
  recipientUserId: int("recipientUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("family_entries_family_date_idx").on(t.familyId, t.occurredAt), index("family_entries_author_idx").on(t.familyId, t.createdByUserId), index("family_entries_recipient_idx").on(t.familyId, t.recipientUserId)]);
