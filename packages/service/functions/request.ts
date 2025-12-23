import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type {
  Class,
  Request,
  RequestId,
  RequestInit,
  ResponseInit,
  UserId,
} from "../models";
import { BaseFunctions } from "./base";
import { assertAck, ResponseAlreadyExistsError } from "./error";

export class RequestFunctions extends BaseFunctions {
  async createRequest(from: UserId, data: RequestInit): Promise<string> {
    const id = new ObjectId().toHexString();
    const result = await this.collections.requests.insertOne({
      ...data,
      id,
      from,
      timestamp: DateTime.now().toISO(),
      response: null,
    });
    assertAck(result, `create request ${JSON.stringify(data)}`);
    return id;
  }

  async getRequestsMadeByUser(userId: UserId): Promise<Request[]> {
    const requests = await this.collections.requests
      .find({ from: userId })
      .toArray();
    return requests;
  }

  /** Get ALL requests in the specified classes */
  async getRequestsInClasses(classes: Array<Class>): Promise<Request[]> {
    if (classes.length === 0) {
      // Ensure that the $or array is non-empty.
      return [];
    }
    const requests = await this.collections.requests
      .find({
        $or: [
          ...classes.map((clazz) => ({
            class: {
              course: clazz.course,
              section: clazz.section,
            },
          })),
        ],
      })
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

    const result = await this.collections.requests.updateOne(
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
    assertAck(result, `create response to request ${requestId}`);
  }
}
