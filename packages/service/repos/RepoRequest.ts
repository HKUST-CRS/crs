import crypto from "node:crypto";
import { buffer } from "node:stream/consumers";
import { finished } from "node:stream/promises";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import {
  type Class,
  type Comment,
  type CommentInit,
  MAX_PROOF_SIZE,
  makeComment,
  makeStatusChange,
  type ProofFile,
  type ProofFileInit,
  Request,
  type RequestDocument,
  type RequestID,
  type RequestInit,
  type RequestStatus,
  type StatusChangeInit,
  statusFromThread,
  type ThreadEntry,
  type UserID,
} from "../models";
import { toISO } from "../utils/datetime";
import { RequestNotFoundError, StatusConflictError } from "./error";

export class RequestRepo {
  constructor(protected collections: Collections) {}

  private parseRequest(document: RequestDocument): Request {
    return Request.parse({
      ...document,
      status: statusFromThread(document.thread),
    });
  }

  async requireRequest(requestID: RequestID): Promise<Request> {
    const request = await this.collections.requests.findOne(
      { id: requestID },
      { projection: { _id: 0 } },
    );
    if (!request) throw new RequestNotFoundError(requestID);
    return this.parseRequest(request);
  }

  async createRequest(
    from: UserID,
    request: RequestInit,
    comment: CommentInit,
  ): Promise<string> {
    const id = new ObjectId().toHexString();
    const text = comment.text;
    const proofs = await this.storeProofs(comment.proofs ?? []);
    try {
      await this.collections.requests.insertOne({
        ...request,
        id,
        from,
        timestamp: toISO(DateTime.now()),
        thread: [
          makeComment(
            {
              id: new ObjectId().toHexString(),
              from,
              timestamp: toISO(DateTime.now()),
            },
            text,
            proofs,
          ),
        ],
      });
    } catch (error) {
      await this.deleteProofs(proofs);
      throw error;
    }
    return id;
  }

  /** Gets requests created by the specified user. */
  async getRequestsFromUser(userID: UserID): Promise<Request[]> {
    const requests = await this.collections.requests
      .find({ from: userID }, { projection: { _id: 0 } })
      .sort({ timestamp: "descending" })
      .toArray();
    return requests.map((request) => this.parseRequest(request));
  }

  /**
   * Get all requests in the specified classes.
   *
   * If a class has section "*", all requests in the course are returned regardless of
   * section.
   *
   */
  async getRequestsInClasses(classes: Array<Class>): Promise<Request[]> {
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
        { projection: { _id: 0 } },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests.map((request) => this.parseRequest(request));
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
      .find(
        {
          id: {
            $in: requestIDs,
          },
        },
        {
          projection: {
            _id: 0,
          },
        },
      )
      .toArray();

    const requestsByID = new Map(
      requests.map((request) => [request.id, this.parseRequest(request)]),
    );

    return requestIDs.flatMap((requestID) => {
      const request = requestsByID.get(requestID);
      return request ? [request] : [];
    });
  }

  /**
   * Gets the request containing the specified proof.
   *
   * If no request contains the proof, `null` is returned.
   */
  async getRequestByProof(proofID: string): Promise<Request | null> {
    const doc = await this.collections.requests.findOne(
      { "thread.proofs.id": proofID },
      { projection: { _id: 0 } },
    );
    return doc ? this.parseRequest(doc) : null;
  }

  /**
   * Atomically appends one or more thread entries to a request,
   * optionally guarded by its current thread-derived status.
   *
   * Pass `expectedStatuses = null` to allow the append from any status
   * (used for comments). Otherwise the append only applies when the
   * request is in an admissible state; a conflicting state throws
   * `StatusConflictError`.
   */
  private async append(
    requestID: RequestID,
    entries: ThreadEntry[],
    expectedStatuses: RequestStatus[] | null,
    op: string,
  ): Promise<void> {
    const proofs = entries.flatMap((entry) =>
      entry.kind === "comment" ? (entry.proofs ?? []) : [],
    );
    const filter: Record<string, unknown> = expectedStatuses
      ? {
          id: requestID,
          $expr: {
            $in: [
              {
                $ifNull: [
                  {
                    $reduce: {
                      input: "$thread",
                      initialValue: null,
                      in: {
                        $cond: [
                          { $eq: ["$$this.kind", "status"] },
                          "$$this.status",
                          "$$value",
                        ],
                      },
                    },
                  },
                  "open",
                ],
              },
              expectedStatuses,
            ],
          },
        }
      : { id: requestID };
    try {
      const result = await this.collections.requests.updateOne(filter, {
        $push: { thread: { $each: entries } },
      });
      if (result.matchedCount === 0) {
        const request = await this.requireRequest(requestID);
        throw new StatusConflictError(
          requestID,
          expectedStatuses?.join("/") ?? "any",
          request.status,
          op,
        );
      }
    } catch (error) {
      await this.deleteProofs(proofs);
      throw error;
    }
  }

  private async createComment(
    userID: UserID,
    init: CommentInit,
  ): Promise<Comment> {
    return makeComment(
      {
        id: new ObjectId().toHexString(),
        from: userID,
        timestamp: toISO(DateTime.now()),
      },
      init.text,
      await this.storeProofs(init.proofs ?? []),
    );
  }

  /**
   * Appends a comment. Comments are allowed in any status (including
   * cancelled), by the requester or any instructor/observer in the
   * class.
   */
  async appendComment(
    userID: UserID,
    requestID: RequestID,
    init: CommentInit,
  ): Promise<Comment> {
    const entry = await this.createComment(userID, init);
    await this.append(requestID, [entry], null, "append a comment");
    return entry;
  }

  /** Appends an optional comment and status change as one guarded update. */
  async appendStatusChange(
    userID: UserID,
    requestID: RequestID,
    init: StatusChangeInit,
    expectedStatuses: RequestStatus[],
    op: string,
    comment?: CommentInit,
  ): Promise<ThreadEntry[]> {
    const statusEntry = makeStatusChange(
      {
        id: new ObjectId().toHexString(),
        from: userID,
        timestamp: toISO(DateTime.now()),
      },
      init,
    );
    const entries: ThreadEntry[] = comment
      ? [await this.createComment(userID, comment), statusEntry]
      : [statusEntry];
    await this.append(requestID, entries, expectedStatuses, op);
    return entries;
  }

  /**
   * Uploads supplied proof files to GridFS and returns their stored references
   * (`id`). The persisted `size` and `hash` are derived from the decoded bytes
   * rather than the client-supplied values, so the per-file limit is enforced
   * on the actual content.
   */
  private async storeProofs(proofs: ProofFileInit[]): Promise<ProofFile[]> {
    const files = proofs.map((file) => {
      const bytes = Buffer.from(file.content, "base64");
      if (bytes.length > MAX_PROOF_SIZE) {
        throw new Error(
          `Proof "${file.name}" exceeds the ${MAX_PROOF_SIZE}-byte limit`,
        );
      }
      return {
        name: file.name,
        bytes,
        size: bytes.length,
        hash: crypto.createHash("sha256").update(bytes).digest("hex"),
      };
    });
    const uploads = files.map(({ name, bytes }) => {
      const id = new ObjectId();
      const promise = Promise.resolve().then(async () => {
        const upload = this.collections.proofs.openUploadStreamWithId(id, name);
        upload.end(bytes);
        await finished(upload, { cleanup: true });
      });
      return { id, promise };
    });
    const results = await Promise.allSettled(
      uploads.map(({ promise }) => promise),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") {
      await Promise.allSettled(
        uploads.map(({ id }) => this.collections.proofs.delete(id)),
      );
      throw failure.reason;
    }
    return files.map((file, i) => {
      const upload = uploads[i];
      if (!upload) throw new Error("File upload returned an incomplete result");
      return {
        name: file.name,
        size: file.size,
        hash: file.hash,
        id: upload.id.toHexString(),
      };
    });
  }

  private async deleteProofs(proofs: ProofFile[]): Promise<void> {
    await Promise.allSettled(
      proofs.map((proof) =>
        this.collections.proofs.delete(new ObjectId(proof.id)),
      ),
    );
  }

  /** Reads the bytes of a stored proof file, returned as base64. */
  async fetchProof(proofID: string): Promise<string> {
    const stream = this.collections.proofs.openDownloadStream(
      new ObjectId(proofID),
    );
    return (await buffer(stream)).toString("base64");
  }
}
