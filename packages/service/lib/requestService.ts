import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import { Request, type RequestInit, type Response } from "../models";
import {
  CourseNotFound,
  RequestHasResponse,
  RequestNotFound,
  UserNotFound,
} from "./util";

export class RequestService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createRequest(data: RequestInit): Promise<string> {
    const user = await this.collections.users.findOne({ email: data.from });
    if (!user) throw UserNotFound(data.from);
    const course = await this.collections.courses.findOne({
      code: data.course.code,
      term: data.course.term,
    });
    if (!course) throw CourseNotFound(data.course);
    const id = new ObjectId().toHexString();
    const result = await this.collections.requests.insertOne({
      id,
      timestamp: DateTime.now().toISO(),
      response: null,
      ...data,
    });
    if (!result.acknowledged) {
      throw new Error(
        `Failed to create request with data: ${JSON.stringify(data)}`,
      );
    }
    return id;
  }

  async getRequest(requestId: string): Promise<Request> {
    const _id = new ObjectId(requestId);
    const request = await this.collections.requests.findOne({ _id });
    if (!request) throw RequestNotFound(_id);
    return Request.parse({ ...request, id: request._id.toHexString() });
  }

  async getRequests(): Promise<Request[]> {
    // TODO: only show requests for the user
    const requests = await this.collections.requests.find().toArray();
    return requests.map((request) =>
      Request.parse({ ...request, id: request._id.toHexString() }),
    );
  }

  async addResponse(requestId: string, response: Response): Promise<void> {
    const _id = new ObjectId(requestId);
    const user = await this.collections.users.findOne({ email: response.from });
    if (!user) throw UserNotFound(response.from);
    const request = await this.collections.requests.findOne({ _id });
    if (!request) throw RequestNotFound(_id);
    if (request.response) throw RequestHasResponse(_id);
    const result = await this.collections.requests.updateOne(
      { _id },
      { $set: { response } },
    );
    if (result.modifiedCount === 0) {
      throw new Error(`Failed to add response to request ${requestId}`);
    }
  }
}
