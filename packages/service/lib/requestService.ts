import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import {
  Classes,
  Request,
  type RequestId,
  type RequestInit,
  type ResponseInit,
  type UserId,
} from "../models";
import {
  CourseNotFoundError,
  RequestNotFoundError,
  ResponseAlreadyExistsError,
  UserClassEnrollmentError,
  UserNotFoundError,
} from "./error";

export class RequestService {
  private collections: Collections;

  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createRequest(from: UserId, data: RequestInit): Promise<string> {
    const user = await this.collections.users.findOne({ email: from });
    if (!user) throw new UserNotFoundError(from);

    const course = await this.collections.courses.findOne({
      code: data.class.course.code,
      term: data.class.course.term,
    });
    if (!course) throw new CourseNotFoundError(data.class.course);

    const enrolled = user.enrollment.some(
      (e) => Classes.id2str(e) === Classes.id2str(data.class),
    );
    if (!enrolled) throw new UserClassEnrollmentError(from, data.class);

    const id = new ObjectId().toHexString();
    const result = await this.collections.requests.insertOne({
      id,
      from,
      timestamp: DateTime.now().toISO(),
      response: null,
      ...data,
    });
    if (!result.acknowledged) {
      throw new Error(`Failed to create request.`);
    }

    return id;
  }

  async getRequest(id: RequestId): Promise<Request> {
    const request = await this.collections.requests.findOne({ id });
    if (!request) throw new RequestNotFoundError(id);
    return Request.parse({ ...request });
  }

  /**
   * Get all requests of a user.
   *
   * A request is _of_ a user, if and only if, the user is the requester, or the user is an
   * instructor of the class that the request is for.
   *
   * @throws UserNotFoundError if the user does not exist
   */
  async getRequests(userId: UserId): Promise<Request[]> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);

    const requests = await this.collections.requests
      .find({
        $or: [
          // If the user is the requester
          {
            from: userId,
          },
          // If the user is an instructor of the class
          ...user.enrollment
            .filter((clazz) => clazz.role === "instructor")
            .map((clazz) => ({
              class: {
                course: clazz.course,
                section: clazz.section,
              },
            })),
        ],
      })
      .toArray();
    return requests.map((request) => Request.parse({ ...request }));
  }

  async createResponse(
    uid: UserId,
    rid: RequestId,
    response: ResponseInit,
  ): Promise<void> {
    const user = await this.collections.users.findOne({ email: uid });
    if (!user) throw new UserNotFoundError(uid);

    const request = await this.collections.requests.findOne({ id: rid });
    if (!request) throw new RequestNotFoundError(rid);
    if (request.response) throw new ResponseAlreadyExistsError(rid);

    const result = await this.collections.requests.updateOne(
      { id: rid },
      {
        $set: {
          response: {
            from: uid,
            timestamp: DateTime.now().toISO(),
            ...response,
          },
        },
      },
    );
    if (!result.acknowledged) {
      throw new Error(`Failed to create response.`);
    }
  }
}
