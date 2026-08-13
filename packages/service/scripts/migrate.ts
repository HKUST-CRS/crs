/**
 * Standalone migration entrypoint: rewrites every request document into the
 * thread schema (monomorphic comment + status entries, status in
 * {open, approved, rejected, appealed, cancelled}, opening reason as the first
 * comment) and moves inline base64 proof bytes into GridFS, leaving a `fileId`
 * reference on each comment. Idempotent — already-migrated documents are
 * skipped, so re-running is safe.
 *
 *   cd packages/service && bun run scripts/migrate.ts
 */
import { DbConn } from "../db";
import { migrateRequests } from "../repos/migrate";

const conn = await DbConn.createFromEnv();
try {
  const report = await migrateRequests(conn.collections);
  console.log(`Scanned ${report.scanned}, migrated ${report.migrated}.`);
} finally {
  await conn.close();
}
