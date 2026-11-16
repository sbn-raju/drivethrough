import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

/**
 * Supabase Postgres connection.
 * `prepare: false` keeps this compatible with Supabase's transaction pooler (port 6543).
 */
export const sqlClient = postgres(env.DATABASE_URL, {
  prepare: false,
  max: env.DATABASE_POOL_MAX,
  ssl: env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1') ? false : 'require',
});

export const db = drizzle(sqlClient, { schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };
