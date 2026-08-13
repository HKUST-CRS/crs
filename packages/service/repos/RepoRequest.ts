import crypto from "node:crypto";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Class,
  CommentEntry,
  Proof,
  ProofFile,
  ProofUpload,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  RequestStatus,
  ThreadEntry,
  UserID,
} from "../models";
import { MAX_PROOF_SIZE } from "../models";
import { toISO } from "../utils/datetime";
import { RequestNotFoundError, StatusConflictError } from "./error";

type EntryBase = { id: string; from: UserID; timestamp: string };

function makeComment(
  base: EntryBase,
  text: string,
  proof?: Proof,
): CommentEntry {
  return {
    ...base,
    kind: "comment",
    text,
    ...(proof ? { proof } : {}),
  };
}

export class RequestRepo {
  constructor(protected collections: Collections) {}

  async requireRequest(requestID: RequestID): Promise<Request> {
    const request = await this.collections.requests.findOne(
      { id: requestID },
      { projection: { _id: 0 } },
    );
    if (!request) throw new RequestNotFoundError(requestID);
    return request;
  }

  async createRequest(from: UserID, data: RequestInit): Promise<string> {
    const id = new ObjectId().toHexString();
    const timestamp = toISO(DateTime.now());
    const { proof, ids } = await this.storeProof(data.details.proof);
    return this.commitProofs(ids, async () => {
      // The opening reason + proof become the first comment in the thread; the
      // stored body carries only class/type/metadata.
      const opening = makeComment(
        { id: new ObjectId().toHexString(), from, timestamp },
        data.details.reason,
        proof,
      );
      // Drop `details` from the stored body (the opening comment already holds
      // the reason + proof); spreading the rest keeps the type/metadata
      // discriminant correlated for the insert.
      const { details: _details, ...rest } = data;
      await this.collections.requests.insertOne({
        ...rest,
        id,
        from,
        timestamp,
        status: "open",
        updates: [opening],
      });
      return id;
    });
  }

  /**
   * Gets request heads created by the specified user.
   *
   * The returned request heads omit `metadata` and `updates`.
   */
  async getRequestHeadsFromUser(userID: UserID): Promise<RequestHead[]> {
    const requests = await this.collections.requests
      .find(
        { from: userID },
        { projection: { _id: 0, metadata: 0, updates: 0 } },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests as unknown as RequestHead[];
  }

  /**
   * Get all request heads in the specified classes.
   *
   * If a class has section "*", all request heads in the course are returned regardless of
   * section.
   *
   * The returned request heads omit `metadata` and `updates`.
   */
  async getRequestHeadsInClasses(
    classes: Array<Class>,
  ): Promise<RequestHead[]> {
    if (classes.length === 0) {
      // Ensure that the $or array is non-empty.
      return [];
    }
    const requests = await this.collections.requests
      .find(
        {
          $or: classes.map((clazz) => {
            if (clazz.section === "*") {
              return {
                "class.course.code": clazz.course.code,
                "class.course.term": clazz.course.term,
              };
            }
            return {
              "class.course.code": clazz.course.code,
              "class.course.term": clazz.course.term,
              "class.section": clazz.section,
            };
          }),
        },
        { projection: { _id: 0, metadata: 0, updates: 0 } },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests as unknown as RequestHead[];
  }

  /**
   * Gets requests with the specified IDs.
   *
   * If a request ID does not exist, it is ignored.
   *
   * The returned requests preserve the input request ID order.
   */
  async getRequestsByID(requestIDs: RequestID[]): Promise<Request[]> {
    if (requestIDs.length === 0) {
      return [];
    }

    const requests = await this.collections.requests
      .find({ id: { $in: requestIDs } }, { projection: { _id: 0 } })
      .toArray();

    const requestsByID = new Map(
      requests.map((request) => [request.id, request as Request]),
    );

    return requestIDs.flatMap((requestID) => {
      const request = requestsByID.get(requestID);
      return request ? [request] : [];
    });
  }

  /**
   * Atomically appends one or more thread entries to a request, optionally
   * guarded by the request's current status and optionally setting a new
   * denormalized status — all in a single `updateOne`.
   *
   * Pass `expectedStatuses = null` to allow the append from any status (used
   * for comments). Otherwise the append only applies when the request is in
   * an admissible state; a conflicting state throws `StatusConflictError`.
   */
  private async append(
    requestID: RequestID,
    entries: ThreadEntry[],
    expectedStatuses: RequestStatus[] | null,
    op: string,
    set?: { status: RequestStatus },
  ): Promise<void> {
    const filter: Record<string, unknown> = expectedStatuses
      ? { id: requestID, status: { $in: expectedStatuses } }
      : { id: requestID };
    const result = await this.collections.requests.updateOne(filter, {
      $push: { updates: { $each: entries } },
      ...(set ? { $set: set } : {}),
    });
    if (result.matchedCount === 0) {
      // Distinguish "not found" from "wrong status" for a clear error.
      const request = await this.requireRequest(requestID);
      throw new StatusConflictError(
        requestID,
        expectedStatuses?.join("/") ?? "any",
        request.status,
        op,
      );
    }
  }

  /**
   * Appends a comment. Comments are allowed in any status (including
   * cancelled), by the requester or any instructor/observer in the class.
   */
  async appendComment(
    userID: UserID,
    requestID: RequestID,
    payload: { text: string; proof?: ProofUpload },
  ): Promise<CommentEntry> {
    const { proof, ids } = await this.storeProof(payload.proof);
    return this.commitProofs(ids, async () => {
      const entry = makeComment(
        {
          id: new ObjectId().toHexString(),
          from: userID,
          timestamp: toISO(DateTime.now()),
        },
        payload.text,
        proof,
      );
      await this.append(requestID, [entry], null, "append a comment");
      return entry;
    });
  }

  /**
   * Appends a status change, optionally preceded by a remark comment (so a
   * decision/cancellation/appeal "with a remark" records the remark as a
   * comment entry then the status-change entry, atomically). Guarded by the
   * admissible source statuses; sets the denormalized status.
   */
  async appendStatusChange(
    userID: UserID,
    requestID: RequestID,
    status: RequestStatus,
    expectedStatuses: RequestStatus[],
    op: string,
    remark?: { text: string; proof?: ProofUpload },
  ): Promise<ThreadEntry[]> {
    const remarkProof = remark
      ? await this.storeProof(remark.proof)
      : undefined;
    return this.commitProofs(remarkProof?.ids ?? [], async () => {
      const timestamp = toISO(DateTime.now());
      const entries: ThreadEntry[] = [];
      if (remark) {
        entries.push(
          makeComment(
            { id: new ObjectId().toHexString(), from: userID, timestamp },
            remark.text,
            remarkProof?.proof,
          ),
        );
      }
      entries.push({
        id: new ObjectId().toHexString(),
        from: userID,
        timestamp,
        kind: "status",
        status,
      });
      await this.append(requestID, entries, expectedStatuses, op, { status });
      return entries;
    });
  }

  // ── Proof (GridFS) ───────────────────────────────────────────────────────

  /**
   * Uploads each supplied proof file to GridFS, returning the stored
   * references (`fileId`) plus the uploaded ObjectIds for rollback. The
   * persisted `size` and `hash` are derived from the decoded bytes rather than
   * the client-supplied values, so the per-file limit is enforced on the
   * actual content. If an upload fails partway, any already-uploaded files are
   * deleted here; the caller must clean up if the subsequent document write
   * fails (see {@link commitProofs}).
   */
  private async storeProof(
    proof?: ProofUpload,
  ): Promise<{ proof: Proof | undefined; ids: ObjectId[] }> {
    if (!proof?.length) return { proof: undefined, ids: [] };
    const stored: ProofFile[] = [];
    const ids: ObjectId[] = [];
    try {
      for (const file of proof) {
        const bytes = Buffer.from(file.content, "base64");
        if (bytes.length > MAX_PROOF_SIZE) {
          throw new Error(
            `Proof "${file.name}" exceeds the ${MAX_PROOF_SIZE}-byte limit`,
          );
        }
        const id = await this.uploadProofBytes(file.name, bytes);
        ids.push(id);
        stored.push({
          name: file.name,
          size: bytes.length,
          hash: crypto.createHash("sha256").update(bytes).digest("hex"),
          fileId: id.toHexString(),
        });
      }
    } catch (e) {
      // Best-effort: delete any files uploaded before the failure. A rejection
      // is expected if the upload itself errored, so swallow it.
      await Promise.all(
        ids.map((id) => this.collections.proofs.delete(id).catch(() => {})),
      );
      throw e;
    }
    return { proof: stored, ids };
  }

  /**
   * Runs a document write, deleting the given proof files from GridFS if the
   * write throws. GridFS uploads do not participate in the Mongo transaction
   * (no session is threaded into `openUploadStream`), so this compensating
   * delete is the only way to avoid orphaned bytes on a failed create/append.
   */
  private async commitProofs<T>(
    ids: ObjectId[],
    write: () => Promise<T>,
  ): Promise<T> {
    try {
      return await write();
    } catch (e) {
      // Best-effort: a rejection is expected if the upload errored, so swallow it.
      await Promise.all(
        ids.map((id) => this.collections.proofs.delete(id).catch(() => {})),
      );
      throw e;
    }
  }

  /** Streams a buffer into GridFS, resolving with the stored file id. */
  private uploadProofBytes(name: string, bytes: Buffer): Promise<ObjectId> {
    const { promise, resolve, reject } = Promise.withResolvers<ObjectId>();
    const upload = this.collections.proofs.openUploadStream(name);
    upload.once("error", reject);
    upload.once("finish", () => resolve(upload.id as unknown as ObjectId));
    upload.end(bytes);
    return promise;
  }

  /** Reads the bytes of a stored proof file, returned as base64. */
  async readProof(fileId: string): Promise<string> {
    const stream = this.collections.proofs.openDownloadStream(
      new ObjectId(fileId),
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString("base64");
  }

  /** Finds the request whose thread carries the given proof file, if any. */
  async findRequestByProofFileId(fileId: string): Promise<Request | null> {
    const doc = await this.collections.requests.findOne(
      { "updates.proof.fileId": fileId },
      { projection: { _id: 0 } },
    );
    return doc as Request | null;
  }
}
