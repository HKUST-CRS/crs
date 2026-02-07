import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Class,
  Request,
  RequestId,
  RequestInit,
  ResponseInit,
  UserId,
} from "../models";
import { RequestNotFoundError, ResponseAlreadyExistsError } from "./error";

export class RequestRepo {
  constructor(protected collections: Collections) {}

  async requireRequest(requestId: RequestId): Promise<Request> {
    const request = await this.collections.requests.findOne({ id: requestId });
    if (!request) throw new RequestNotFoundError(requestId);
    return request;
  }

  async createRequest(from: UserId, data: RequestInit): Promise<string> {
    const id = new ObjectId().toHexString();
    await this.collections.requests.insertOne({
      ...data,
      id,
      from,
      timestamp: DateTime.now().toISO(),
      response: null,
    });
    return id;
  }

  async getRequestsFromUser(userId: UserId): Promise<Request[]> {
    const requests = await this.collections.requests
      .find({ from: userId })
      .sort({ timestamp: "descending" })
      .toArray();
    return requests;
  }

  /**
   * Get all requests in the specified classes.
   *
   * If a class has section "*", all requests in the course are returned regardless of section.
   */
  async getRequestsInClasses(classes: Array<Class>): Promise<Request[]> {
    if (classes.length === 0) {
      // Ensure that the $or array is non-empty.
      return [];
    }
    const requests = await this.collections.requests
      .find({
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
      })
      .sort({ timestamp: "descending" })
      .toArray();
    return requests;
  }

  async createResponse(
    userId: UserId,
    requestId: RequestId,
    response: ResponseInit,
  ): Promise<void> {
    const request = await this.requireRequest(requestId);
    if (request.response) {
      throw new ResponseAlreadyExistsError(requestId);
    }
    await this.collections.requests.updateOne(
      { id: requestId },
      {
        $set: {
          response: {
            ...response,
            from: userId,
            timestamp: DateTime.now().toISO(),
          },
        },
      },
    );
  }
}
