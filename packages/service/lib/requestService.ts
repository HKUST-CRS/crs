import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import type { Request, Response } from "../models";

export class RequestService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createRequest(data: Request): Promise<void> {
    await this.collections.requests.insertOne(data);
  }

  async addResponse(requestId: ObjectId, response: Response): Promise<void> {
    const request = await this.collections.requests.findOne({ _id: requestId });
    if (!request) throw new Error("Request not found");
    if (request.response) throw new Error("Request already has a response");
    await this.collections.requests.updateOne(
      { _id: requestId },
      { $set: { response } }
    );
  }
}
