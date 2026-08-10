import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Class,
  CommentEntry,
  Proof,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  RequestStatus,
  ThreadEntry,
  UserID,
} from "../models";
import { toISO } from "../utils/datetime";
import { RequestNotFoundError, StatusConflictError } from "./error";

// ── Legacy document tolerance ────────────────────────────────────────────────
// Documents written before this thread redesign store the opening reason+proof
// in `details` on the body, use the old status value "resolved", and record
// activity as response/cancel/appeal entry kinds. These helpers normalize such
// documents on read so the rest of the system only ever sees the new shape:
// monomorphic comment + status-change entries, status in
// {open, approved, rejected, appealed, cancelled}, and the opening reason as
// the first comment. No forced pre-deploy migration is required.

type LegacyResponse = {
  decision?: "Approve" | "Reject";
  remarks?: string;
  from?: UserID;
  timestamp?: string;
} | null;
type LegacyDetails = { reason?: string; proof?: Proof } | undefined;
type LegacyDoc = {
  id: string;
  from: UserID;
  timestamp: string;
  status?: string;
  response?: LegacyResponse;
  details?: LegacyDetails;
  updates?: unknown[];
};

/** Maps any stored status (including legacy "resolved" / absent) to the new enum. */
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
      // Legacy "resolved" carries the decision on `response`.
      return response?.decision === "Reject" ? "rejected" : "approved";
    default:
      // Pre-thread documents have no `status` field at all.
      return response
        ? response.decision === "Reject"
          ? "rejected"
          : "approved"
        : "open";
  }
}

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

/**
 * Converts a raw thread (which may mix new comment/status entries with legacy
 * response/cancel/appeal entries) into the new monomorphic shape. A legacy
 * response/cancel/appeal with accompanying text becomes a comment entry
 * followed by the status-change entry, preserving the remark.
 */
function normalizeEntries(raw: unknown[]): ThreadEntry[] {
  const out: ThreadEntry[] = [];
  for (const e of raw) {
    const entry = e as EntryBase & {
      kind: string;
      text?: string;
      proof?: Proof;
      status?: RequestStatus;
      remarks?: string;
      decision?: "Approve" | "Reject";
    };
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
  // A legacy body without any opening reason comment (pre-thread) gets a
  // synthesized opening comment from `details`, so the reason is preserved.
  return out;
}

function normalizeRequest(doc: LegacyDoc & Record<string, unknown>): Request {
  const owner: EntryBase = {
    id: `${doc.id}#opening`,
    from: doc.from,
    timestamp: doc.timestamp,
  };
  const updates = normalizeEntries(doc.updates ?? []);
  // Legacy bodies carry the opening reason+proof in `details` (it was never
  // recorded in the thread); synthesize the opening comment so the reason is
  // preserved as the first entry, ahead of any converted follow-up entries.
  // New documents have no `details`, so this is a no-op for them.
  if (doc.details?.reason) {
    updates.unshift(makeComment(owner, doc.details.reason, doc.details.proof));
  }
  // A pre-thread body carries the instructor decision only on the top-level
  // `response` field (never in the thread); synthesize the remark comment +
  // status-change entry so the decider, timestamp, and remark survive. Skip
  // when the thread already records a decision — feat/threads-era documents
  // carry it both as an `updates` entry and denormalized on `response`.
  const response = doc.response;
  if (response?.decision) {
    const alreadyDecided = updates.some(
      (e) =>
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
  // Drop legacy-only body fields so the result matches the new schema.
  const { details, response: _response, updates: _updates, ...rest } = doc;
  return {
    ...rest,
    status: normalizeStatus(doc.status, doc.response ?? null),
    updates,
  } as Request;
}

function normalizeRequestHead(
  doc: LegacyDoc & Record<string, unknown>,
): RequestHead {
  const { details, response, updates, ...rest } = doc;
  return {
    ...rest,
    status: normalizeStatus(doc.status, doc.response ?? null),
  } as RequestHead;
}

/**
 * Builds the status match condition for a guarded append, including legacy
 * fallbacks: old "resolved" documents and pre-thread documents (no `status`)
 * are admitted when the expected set covers the corresponding new state.
 */
function statusGuard(expected: RequestStatus[]): Record<string, unknown>[] {
  const conds: Record<string, unknown>[] = [{ status: { $in: expected } }];
  const admitsDecided =
    expected.includes("approved") || expected.includes("rejected");
  if (admitsDecided) {
    conds.push({ status: "resolved" });
    conds.push({ status: { $exists: false }, response: { $ne: null } });
  }
  if (expected.includes("open")) {
    conds.push({ status: { $exists: false }, response: null });
  }
  return conds;
}

export class RequestRepo {
  constructor(protected collections: Collections) {}

  async requireRequest(requestID: RequestID): Promise<Request> {
    const request = await this.collections.requests.findOne({ id: requestID });
    if (!request) throw new RequestNotFoundError(requestID);
    return normalizeRequest(request);
  }

  async createRequest(from: UserID, data: RequestInit): Promise<string> {
    const id = new ObjectId().toHexString();
    const timestamp = toISO(DateTime.now());
    // The opening reason + proof become the first comment in the thread; the
    // stored body carries only class/type/metadata.
    const opening: CommentEntry = {
      id: new ObjectId().toHexString(),
      from,
      timestamp,
      kind: "comment",
      text: data.details.reason,
      ...(data.details.proof ? { proof: data.details.proof } : {}),
    };
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
        {
          projection: {
            _id: 0,
            metadata: 0,
            updates: 0,
          },
        },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests.map(normalizeRequestHead);
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
        {
          projection: {
            _id: 0,
            metadata: 0,
            updates: 0,
          },
        },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests.map(normalizeRequestHead);
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
      requests.map((request) => [request.id, normalizeRequest(request)]),
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
   * for comments). Otherwise the append only applies when the request is in an
   * admissible state; a conflicting state throws `StatusConflictError`.
   */
  private async append(
    requestID: RequestID,
    entries: ThreadEntry[],
    expectedStatuses: RequestStatus[] | null,
    op: string,
    set?: { status: RequestStatus },
  ): Promise<void> {
    const filter: Record<string, unknown> = { id: requestID };
    if (expectedStatuses) {
      filter.$or = statusGuard(expectedStatuses);
    }
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
    payload: { text: string; proof?: Proof },
  ): Promise<CommentEntry> {
    const entry = makeComment(
      {
        id: new ObjectId().toHexString(),
        from: userID,
        timestamp: toISO(DateTime.now()),
      },
      payload.text,
      payload.proof,
    );
    await this.append(requestID, [entry], null, "append a comment");
    return entry;
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
    remark?: { text: string; proof?: Proof },
  ): Promise<ThreadEntry[]> {
    const timestamp = toISO(DateTime.now());
    const entries: ThreadEntry[] = [];
    if (remark) {
      entries.push(
        makeComment(
          { id: new ObjectId().toHexString(), from: userID, timestamp },
          remark.text,
          remark.proof,
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
  }
}
