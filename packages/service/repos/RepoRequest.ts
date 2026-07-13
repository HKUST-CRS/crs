import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  AppealEntry,
  CancelEntry,
  Class,
  CommentEntry,
  Proof,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  RequestStatus,
  ResponseEntry,
  ResponseInit,
  ThreadEntry,
  UserID,
} from "../models";
import { toISO } from "../utils/datetime";
import { RequestNotFoundError, StatusConflictError } from "./error";

/**
 * Fills in the `status` and `updates` fields for documents written before the
 * thread feature implementation. `status` is inferred from `response` (non-null implies
 * "resolved", otherwise "open"); `updates` defaults to an empty thread.
 */
function inferStatus(doc: {
  response: Request["response"];
  status?: RequestStatus;
}): RequestStatus {
  switch (doc.status) {
    case "open":
    case "cancelled":
    case "resolved":
      return doc.status;
    default:
      return doc.response ? "resolved" : "open";
  }
}

function normalizeRequest(doc: Request): Request {
  return {
    ...doc,
    status: inferStatus(doc),
    updates: doc.updates ?? [],
  };
}

function normalizeRequestHead(doc: RequestHead): RequestHead {
  return { ...doc, status: inferStatus(doc) };
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
    await this.collections.requests.insertOne({
      ...data,
      id,
      from,
      timestamp: toISO(DateTime.now()),
      response: null,
      status: "open",
      updates: [],
    });
    return id;
  }

  /**
   * Gets request heads created by the specified user.
   *
   * The returned request heads omit `details`, `metadata`, and `updates`.
   */
  async getRequestHeadsFromUser(userID: UserID): Promise<RequestHead[]> {
    const requests = await this.collections.requests
      .find(
        { from: userID },
        {
          projection: {
            _id: 0,
            details: 0,
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
   * The returned request heads omit `details`, `metadata`, and `updates`.
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
            details: 0,
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
   * Atomically appends a thread entry to a request, guarded by the request's
   * current status. The `expectedStatuses` filter ensures the operation only
   * applies when the request is in an admissible state (e.g. a response is only
   * allowed while "open"); a conflicting state throws `StatusConflictError`.
   * `set` carries any denormalized side-effect fields (such as the latest
   * `response` or the new `status`) written in the same atomic update.
   */
  async appendUpdate(
    requestID: RequestID,
    entry: ThreadEntry,
    expectedStatuses: RequestStatus[],
    op: string,
    set?: Record<string, unknown>,
  ): Promise<void> {
    // Build a status guard that also admits legacy documents written before
    // the thread feature existed (which have no `status` field). For those,
    // status is inferred from `response` (null ⇒ open, non-null ⇒ resolved),
    // matching the read-time normalization. This keeps writes working even
    // before the backfill has run, so no pre-deploy migration is required.
    const conds: Record<string, unknown>[] = [
      { status: { $in: expectedStatuses } },
    ];
    if (expectedStatuses.includes("open")) {
      conds.push({ status: { $exists: false }, response: null });
    }
    if (expectedStatuses.includes("resolved")) {
      conds.push({ status: { $exists: false }, response: { $ne: null } });
    }

    const result = await this.collections.requests.updateOne(
      { id: requestID, $or: conds },
      {
        $push: { updates: entry },
        ...(set ? { $set: set } : {}),
      },
    );
    if (result.matchedCount === 0) {
      // Distinguish "not found" from "wrong status" for a clear error.
      const request = await this.requireRequest(requestID);
      throw new StatusConflictError(
        requestID,
        expectedStatuses.join("/"),
        request.status,
        op,
      );
    }
  }

  async appendComment(
    userID: UserID,
    requestID: RequestID,
    payload: { text: string; proof?: Proof },
  ): Promise<CommentEntry> {
    const entry: CommentEntry = {
      id: new ObjectId().toHexString(),
      from: userID,
      timestamp: toISO(DateTime.now()),
      kind: "comment",
      text: payload.text,
      ...(payload.proof ? { proof: payload.proof } : {}),
    };
    // Comments are allowed on open or resolved requests, but not on cancelled.
    await this.appendUpdate(
      requestID,
      entry,
      ["open", "resolved"],
      "append a comment",
    );
    return entry;
  }

  async appendResponse(
    userID: UserID,
    requestID: RequestID,
    response: ResponseInit,
  ): Promise<ResponseEntry> {
    const timestamp = toISO(DateTime.now());
    const entry: ResponseEntry = {
      id: new ObjectId().toHexString(),
      from: userID,
      timestamp,
      kind: "response",
      remarks: response.remarks,
      decision: response.decision,
    };
    // A response is only allowed while the request is open (including after an
    // appeal reopened it). Denormalize the latest response and mark resolved.
    await this.appendUpdate(requestID, entry, ["open"], "respond", {
      response: { ...response, from: userID, timestamp },
      status: "resolved",
    });
    return entry;
  }

  async appendCancel(
    userID: UserID,
    requestID: RequestID,
    text?: string,
  ): Promise<CancelEntry> {
    const entry: CancelEntry = {
      id: new ObjectId().toHexString(),
      from: userID,
      timestamp: toISO(DateTime.now()),
      kind: "cancel",
      ...(text !== undefined ? { text } : {}),
    };
    // Cancellation is only allowed while the request is open; it is terminal.
    await this.appendUpdate(requestID, entry, ["open"], "cancel", {
      status: "cancelled",
    });
    return entry;
  }

  async appendAppeal(
    userID: UserID,
    requestID: RequestID,
    payload: { text: string; proof?: Proof },
  ): Promise<AppealEntry> {
    const entry: AppealEntry = {
      id: new ObjectId().toHexString(),
      from: userID,
      timestamp: toISO(DateTime.now()),
      kind: "appeal",
      text: payload.text,
      ...(payload.proof ? { proof: payload.proof } : {}),
    };
    // An appeal is only allowed on a resolved request; it reopens the request.
    await this.appendUpdate(requestID, entry, ["resolved"], "appeal", {
      status: "open",
    });
    return entry;
  }
}
