import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import type { Collections } from "../db";
import {
  Classes,
  Request,
  type RequestId,
  type RequestInit,
  type ResponseInit,
  type Role,
  type UserId,
} from "../models";
import {
  CourseNotFoundError,
  RequestNotFoundError,
  ResponseAlreadyExistsError,
  UserClassEnrollmentError,
  UserNotFoundError,
  UserPermissionError,
} from "./error";

export class RequestService {
  private collections: Collections;

  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createRequest(from: UserId, data: RequestInit): Promise<string> {
    const user = await this.collections.users.findOne({ email: from });
    if (!user) throw new UserNotFoundError(from);

    UserPermissionError.assertRole(
      user,
      data.class,
      "student",
      `create request`,
    );

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
   * Get all requests of a user, as a specific role.
   *
   * If the role is "student", this returns all requests made by the user.
   *
   * If the role is "instructor" or "ta", this returns all requests for classes that the user
   * is an instructor or ta of.
   *
   * @throws UserNotFoundError if the user does not exist
   */
  async getRequestsAs(uid: UserId, role: Role): Promise<Request[]> {
    const user = await this.collections.users.findOne({ email: uid });
    if (!user) throw new UserNotFoundError(uid);

    const requests = await this.collections.requests
      .find({
        ...(role === "student"
          ? {
              from: uid,
            }
          : {
              $or: [
                ...user.enrollment
                  .filter((clazz) => clazz.role === role)
                  .map((clazz) => ({
                    class: {
                      course: clazz.course,
                      section: clazz.section,
                    },
                  })),
                // This condition is to ensure that the $or array is non-empty.
                {
                  $expr: {
                    $eq: [1, 0],
                  },
                },
              ],
            }),
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

    UserPermissionError.assertRole(
      user,
      request.class,
      "instructor",
      `create response for request ${rid}`,
    );

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
