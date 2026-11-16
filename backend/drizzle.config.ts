import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Use the Supabase *direct* or *session pooler* connection string for migrations.
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
