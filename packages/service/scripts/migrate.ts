/**
 * Standalone migration entrypoint: rewrites every request document into the
 * thread schema (monomorphic comment + status entries, status in
 * {open, approved, rejected, appealed, cancelled}, opening reason as the
 * first comment) and moves inline base64 proof bytes into GridFS, leaving a
 * `attachmentId` reference on each comment. Idempotent — already-migrated
 * documents are skipped and orphaned GridFS bytes from an interrupted run
 * are swept, so re-running is safe.
 *
 *   cd packages/service && bun run scripts/migrate.ts
 */
import { DbConn } from "../db";
import { migrateRequests } from "../repos/migrate";

const conn = await DbConn.createFromEnv();
try {
  const report = await migrateRequests(conn.collections);
  console.log(
    `Scanned ${report.scanned}, migrated ${report.migrated}, removed ${report.orphansRemoved} orphaned proof file(s).`,
  );
} finally {
  await conn.close();
}
