CREATE TABLE `families` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `ownerUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `families_owner_idx` (`ownerUserId`),
  CONSTRAINT `families_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`)
);

CREATE TABLE `family_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `familyId` int NOT NULL,
  `userId` int NOT NULL,
  `canView` boolean NOT NULL DEFAULT TRUE,
  `canAdd` boolean NOT NULL DEFAULT TRUE,
  `canEditOwn` boolean NOT NULL DEFAULT TRUE,
  `joinedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_members_family_user_uq` (`familyId`, `userId`),
  KEY `family_members_user_idx` (`userId`),
  CONSTRAINT `family_members_family_fk` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `family_members_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);

CREATE TABLE `family_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `familyId` int NOT NULL,
  `invitedByUserId` int NOT NULL,
  `invitedEmail` varchar(320) NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `revokedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_invitations_tokenHash_uq` (`tokenHash`),
  KEY `family_invites_family_idx` (`familyId`),
  KEY `family_invites_email_idx` (`invitedEmail`),
  CONSTRAINT `family_invitations_family_fk` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `family_invitations_inviter_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users` (`id`)
);

CREATE TABLE `family_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `familyId` int NOT NULL,
  `createdByUserId` int NOT NULL,
  `type` enum('expense','allowance') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `occurredAt` timestamp NOT NULL,
  `description` varchar(500) NULL,
  `category` varchar(120) NULL,
  `recipientUserId` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `family_entries_family_date_idx` (`familyId`, `occurredAt`),
  KEY `family_entries_author_idx` (`familyId`, `createdByUserId`),
  KEY `family_entries_recipient_idx` (`familyId`, `recipientUserId`),
  CONSTRAINT `family_entries_family_fk` FOREIGN KEY (`familyId`) REFERENCES `families` (`id`) ON DELETE CASCADE,
  CONSTRAINT `family_entries_author_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `family_entries_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users` (`id`)
);
