import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Class,
  Request,
  RequestID,
  RequestInit,
  ResponseInit,
  UserID,
} from "../models";
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
      timestamp: DateTime.now().toISO(),
      response: null,
    });
    return id;
  }

  async getRequestsFromUser(userID: UserID): Promise<Request[]> {
    const requests = await this.collections.requests
      .find({ from: userID })
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
            timestamp: DateTime.now().toISO(),
          },
        },
      },
    );
  }
}
