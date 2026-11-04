import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const parentAccounts = sqliteTable('parent_accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const familyDocuments = sqliteTable('family_documents', {
  parentId: text('parent_id').primaryKey().references(() => parentAccounts.id, { onDelete: 'cascade' }),
  document: text('document').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [
  check('family_document_valid_json', sql`json_valid(${table.document})`),
  check('family_document_positive_revision', sql`${table.revision} >= 1`),
]);
