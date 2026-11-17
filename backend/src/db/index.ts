import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

/**
 * Supabase Postgres connection.
 * - `prepare: false` keeps this compatible with Supabase's transaction pooler (port 6543).
 * - `max_pipeline: 1`: Supavisor before 2.10 never answers pipelined queries in transaction mode, so
 *   concurrent queries (e.g. `Promise.all`) wedged connections and every later request queued behind them.
 * - `query_timeout` / `queue_timeout`: a pooler or network that goes silent fails the request instead of
 *   hanging it; the pool reconnects for the next query.
 */
export const sqlClient = postgres(env.DATABASE_URL, {
  prepare: false,
  max_pipeline: 1,
  query_timeout: 20,
  queue_timeout: 10,
  max: env.DATABASE_POOL_MAX,
  ssl: env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1') ? false : 'require',
});

export const db = drizzle(sqlClient, { schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };
