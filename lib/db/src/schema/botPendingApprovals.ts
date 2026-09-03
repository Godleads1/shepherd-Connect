import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";
import { usersTable } from "./users";

export const botPendingApprovalsTable = pgTable("bot_pending_approvals", {
  refNumber: text("ref_number").primaryKey(),
  parentJid: text("parent_jid").notNull(),
  supportJid: text("support_jid").notNull(),
  childName: text("child_name").notNull(),
  requestType: text("request_type").notNull(), // checkin | checkout | delegate_pickup
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  parentUserId: integer("parent_user_id").notNull().references(() => usersTable.id),
  assignedSupportId: integer("assigned_support_id").notNull().references(() => usersTable.id),
  parentContactVersion: integer("parent_contact_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BotPendingApproval = typeof botPendingApprovalsTable.$inferSelect;
