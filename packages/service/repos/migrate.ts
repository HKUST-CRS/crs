import crypto from "node:crypto";
import type { GridFSBucket, ObjectId, WithoutId } from "mongodb";
import type { Collections } from "../db";
import type { Request, RequestStatus } from "../models";

// ── Legacy → thread-schema migration ────────────────────────────────────────
// Documents written before this thread redesign store the opening reason+proof
// in `details` on the body, use the old status value "resolved", and record
// activity as response/cancel/appeal entry kinds. They also embed proof bytes
// inline as base64. This migration rewrites every request document into the new
// shape — monomorphic comment + status-change entries, status in
// {open, approved, rejected, appealed, cancelled}, the opening reason as the
// first comment — and moves proof bytes into GridFS, leaving a `fileId`
// reference on each comment. Run once at deploy; it is idempotent.

type LegacyResponse = {
  decision?: "Approve" | "Reject";
  remarks?: string;
  from?: string;
  timestamp?: string;
} | null;

// A proof file as it may appear in a stored document: legacy/current docs carry
// base64 `content`; already-migrated docs carry `fileId` (+ `hash`/`size`
// derived from the bytes during migration).
type RawProofFile = {
  name?: string;
  size?: number;
  content?: string;
  hash?: string;
  fileId?: string;
};

type EntryBase = { id: string; from: string; timestamp: string };

// The union of legacy and current entry shapes found in `updates`.
type RawEntry = EntryBase & {
  kind: string;
  text?: string;
  proof?: RawProofFile[];
  status?: RequestStatus;
  remarks?: string;
  decision?: "Approve" | "Reject";
};

type CommentEntry = EntryBase & {
  kind: "comment";
  text: string;
  proof?: RawProofFile[];
};
type StatusEntry = EntryBase & { kind: "status"; status: RequestStatus };
type NormalizedEntry = CommentEntry | StatusEntry;

type RawDoc = {
  id: string;
  from: string;
  timestamp: string;
  status?: string;
  response?: LegacyResponse;
  details?: { reason?: string; proof?: RawProofFile[] };
  updates?: RawEntry[];
} & Record<string, unknown>;

function makeComment(
  base: EntryBase,
  text: string,
  proof?: RawProofFile[],
): CommentEntry {
  return {
    ...base,
    kind: "comment",
    text,
    ...(proof && proof.length > 0 ? { proof } : {}),
  };
}

function normalizeStatus(
  status: string | undefined,
  response: LegacyResponse,
): RequestStatus {
  switch (status) {
    case "open":
    case "cancelled":
    case "approved":
    case "rejected":
    case "appealed":
      return status;
    case "resolved":
      return response?.decision === "Reject" ? "rejected" : "approved";
    default:
      return response
        ? response.decision === "Reject"
          ? "rejected"
          : "approved"
        : "open";
  }
}

function normalizeEntries(raw: RawEntry[]): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  for (const entry of raw) {
    const base: EntryBase = {
      id: entry.id,
      from: entry.from,
      timestamp: entry.timestamp,
    };
    switch (entry.kind) {
      case "comment":
        out.push(makeComment(base, entry.text ?? "", entry.proof));
        break;
      case "status":
        out.push({ ...base, kind: "status", status: entry.status ?? "open" });
        break;
      case "response":
        if (entry.remarks) out.push(makeComment(base, entry.remarks));
        out.push({
          ...base,
          kind: "status",
          status: entry.decision === "Reject" ? "rejected" : "approved",
        });
        break;
      case "cancel":
        if (entry.text) out.push(makeComment(base, entry.text));
        out.push({ ...base, kind: "status", status: "cancelled" });
        break;
      case "appeal":
        if (entry.text) out.push(makeComment(base, entry.text, entry.proof));
        out.push({ ...base, kind: "status", status: "appealed" });
        break;
    }
  }
  return out;
}

/**
 * Normalizes a stored request document into the thread schema. Proof bytes
 * (base64 `content`) are preserved on the comment entries for the subsequent
 * GridFS conversion pass. Already-new-shape documents pass through unchanged.
 */
function normalizeRequest(doc: RawDoc): Record<string, unknown> {
  const owner: EntryBase = {
    id: `${doc.id}#opening`,
    from: doc.from,
    timestamp: doc.timestamp,
  };
  const updates: NormalizedEntry[] = normalizeEntries(doc.updates ?? []);
  if (doc.details?.reason) {
    updates.unshift(makeComment(owner, doc.details.reason, doc.details.proof));
  }
  const response = doc.response;
  if (response?.decision) {
    const alreadyDecided = updates.some(
      (e): e is StatusEntry =>
        e.kind === "status" &&
        (e.status === "approved" || e.status === "rejected"),
    );
    if (!alreadyDecided) {
      const base: EntryBase = {
        id: `${doc.id}#decision`,
        from: response.from ?? owner.from,
        timestamp: response.timestamp ?? owner.timestamp,
      };
      if (response.remarks) updates.push(makeComment(base, response.remarks));
      updates.push({
        ...base,
        kind: "status",
        status: response.decision === "Reject" ? "rejected" : "approved",
      });
    }
  }
  const { details, response: _response, updates: _updates, ...rest } = doc;
  return {
    ...rest,
    status: normalizeStatus(doc.status, doc.response ?? null),
    updates,
  };
}

/**
 * Uploads any inline base64 proof content to GridFS, replacing `content` with a
 * `fileId` reference. Files already carrying a `fileId` are left untouched.
 * Returns true if any bytes were uploaded (i.e. the document changed).
 */
async function convertProofsToGridFS(
  updates: NormalizedEntry[],
  bucket: GridFSBucket,
): Promise<boolean> {
  let changed = false;
  for (const entry of updates) {
    if (entry.kind !== "comment" || !entry.proof) continue;
    for (const file of entry.proof) {
      if (file.fileId || !file.content) continue;
      const bytes = Buffer.from(file.content, "base64");
      const id = await uploadProofBytes(bucket, file.name ?? "proof", bytes);
      delete file.content;
      file.fileId = id;
      // Derive size/hash from the bytes so migrated docs match fresh uploads.
      file.size = bytes.length;
      file.hash = crypto.createHash("sha256").update(bytes).digest("hex");
      changed = true;
    }
  }
  return changed;
}

function uploadProofBytes(
  bucket: GridFSBucket,
  name: string,
  bytes: Buffer,
): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const upload = bucket.openUploadStream(name);
  upload.once("error", reject);
  upload.once("finish", () =>
    resolve((upload.id as unknown as ObjectId).toHexString()),
  );
  upload.end(bytes);
  return promise;
}

const NEW_STATUSES: Record<string, true> = {
  open: true,
  approved: true,
  rejected: true,
  appealed: true,
  cancelled: true,
};

function hasLegacyShape(doc: RawDoc): boolean {
  if (doc.details || doc.response) return true;
  if (doc.status && !NEW_STATUSES[doc.status]) return true;
  return (doc.updates ?? []).some((e) =>
    ["response", "cancel", "appeal"].includes(e.kind),
  );
}

function hasInlineProof(updates: NormalizedEntry[] | RawEntry[]): boolean {
  return updates.some(
    (e) =>
      e.kind === "comment" &&
      Array.isArray(e.proof) &&
      e.proof.some((f) => !!f.content),
  );
}

export interface MigrationReport {
  scanned: number;
  migrated: number;
  orphansRemoved: number;
}

/**
 * Migrates all request documents to the thread schema and moves inline proof
 * bytes into GridFS. Idempotent: documents already in the new shape with
 * `fileId` proof references are left untouched, and any orphaned GridFS bytes
 * (e.g. from an interrupted earlier run) are swept.
 */
export async function migrateRequests(
  collections: Collections,
): Promise<MigrationReport> {
  const docs = (await collections.requests
    .find({})
    .toArray()) as unknown as RawDoc[];
  let migrated = 0;
  const referenced = new Set<string>();
  for (const doc of docs) {
    const needsShape = hasLegacyShape(doc);
    const normalized = needsShape
      ? (normalizeRequest(doc) as { updates: NormalizedEntry[] } & Record<
          string,
          unknown
        >)
      : doc;
    const needsProof = hasInlineProof(normalized.updates ?? []);
    if (needsProof) {
      await convertProofsToGridFS(
        (normalized.updates ?? []) as NormalizedEntry[],
        collections.proofs,
      );
    }
    if (needsShape || needsProof) {
      await collections.requests.replaceOne(
        { id: doc.id },
        normalized as unknown as WithoutId<Request>,
      );
      migrated++;
    }
    for (const entry of normalized.updates ?? []) {
      if (entry.kind !== "comment" || !entry.proof) continue;
      for (const file of entry.proof) {
        if (file.fileId) referenced.add(file.fileId);
      }
    }
  }
  // A crash between a GridFS upload and its document write leaves orphaned
  // bytes (and a re-run would upload duplicates), so delete any file that no
  // document references. Run with the old code stopped so nothing is
  // mid-upload while this sweeps.
  let orphansRemoved = 0;
  for await (const file of collections.proofs.find()) {
    if (referenced.has(file._id.toHexString())) continue;
    await collections.proofs.delete(file._id).catch(() => {});
    orphansRemoved++;
  }
  return { scanned: docs.length, migrated, orphansRemoved };
}
