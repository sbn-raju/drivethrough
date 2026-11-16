import type { Request } from 'express';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

/** Best-effort audit trail. Never include secrets (passwords, OTPs, tokens) in metadata. */
export async function audit(
  req: Request | null,
  action: string,
  opts: { actorUserId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
) {
  try {
    await db.insert(auditLogs).values({
      action,
      actorUserId: opts.actorUserId ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      metadata: opts.metadata,
      ipAddress: req?.ip ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', action, err);
  }
}
