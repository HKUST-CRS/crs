import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
import {
  Request,
  type RequestId,
  type RequestInit,
  type ResponseInit,
  type Role,
  type UserId,
} from "../models";
import { assertAck, BaseService } from "./baseService";
import { ResponseAlreadyExistsError } from "./error";
import { assertClassRole } from "./permission";

export class RequestService extends BaseService {
  async createRequest(from: UserId, data: RequestInit): Promise<string> {
    const user = await this.requireUser(from);
    // only students in the class can create requests
    assertClassRole(user, data.class, ["student"], "creating request");

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

  async getRequest(uid: UserId, id: RequestId): Promise<Request> {
    const user = await this.requireUser(uid);
    const request = await this.requireRequest(id);
    if (uid !== request.from) {
      // only the requester or instructors/TAs in the class can view the request
      assertClassRole(
        user,
        request.class,
        ["instructor", "ta"],
        `viewing request ${id}`,
      );
    }
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
    const user = await this.requireUser(uid);

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
    const user = await this.requireUser(uid);
    const request = await this.requireRequest(rid);
    // only instructors of the class can create responses
    assertClassRole(
      user,
      request.class,
      ["instructor"],
      `creating response for request ${rid}`,
    );
    if (request.response) {
      throw new ResponseAlreadyExistsError(rid);
    }

    const result = await this.collections.requests.updateOne(
      { id: rid },
      {
        $set: {
          response: {
            ...response,
            from: uid,
            timestamp: DateTime.now().toISO(),
          },
        },
      },
    );
    assertAck(result, `create response to ${rid}`);
  }
}
