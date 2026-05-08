import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Class,
  Request,
  RequestHead,
  RequestID,
  RequestInit,
  ResponseInit,
  UserID,
} from "../models";
import { toISO } from "../utils/datetime";
import { RequestNotFoundError, ResponseAlreadyExistsError } from "./error";

export class RequestRepo {
  constructor(protected collections: Collections) {}

  async requireRequest(requestID: RequestID): Promise<Request> {
    const request = await this.collections.requests.findOne({ id: requestID });
    if (!request) throw new RequestNotFoundError(requestID);
    return request;
  }

  async createRequest(from: UserID, data: RequestInit): Promise<string> {
    const id = new ObjectId().toHexString();
    await this.collections.requests.insertOne({
      ...data,
      id,
      from,
      timestamp: toISO(DateTime.now()),
      response: null,
    });
    return id;
  }

  /**
   * Gets request heads created by the specified user.
   *
   * The returned request heads omit `details` and `metadata`.
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
          },
        },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests;
  }

  /**
   * Get all request heads in the specified classes.
   *
   * If a class has section "*", all request heads in the course are returned regardless of
   * section.
   *
   * The returned request heads omit `details` and `metadata`.
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
          },
        },
      )
      .sort({ timestamp: "descending" })
      .toArray();
    return requests;
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
      requests.map((request) => [request.id, request]),
    );

    return requestIDs.flatMap((requestID) => {
      const request = requestsByID.get(requestID);
      return request ? [request] : [];
    });
  }

  async createResponse(
    userID: UserID,
    requestID: RequestID,
    response: ResponseInit,
  ): Promise<void> {
    const request = await this.requireRequest(requestID);
    if (request.response) {
      throw new ResponseAlreadyExistsError(requestID);
    }
    await this.collections.requests.updateOne(
      { id: requestID },
      {
        $set: {
          response: {
            ...response,
            from: userID,
            timestamp: toISO(DateTime.now()),
          },
        },
      },
    );
  }
}
