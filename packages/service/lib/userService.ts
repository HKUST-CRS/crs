import type { Collections } from "../db";
import {
  type Class,
  Request,
  type Role,
  type User,
  type UserId,
} from "../models";
import { UserNotFoundError } from "./error";

export class UserService {
  private collections: Collections;
  constructor(collection: Collections) {
    this.collections = collection;
  }

  async createUser(data: User): Promise<void> {
    const result = await this.collections.users.insertOne(data);
    if (!result.acknowledged) throw new Error("Failed to create user");
  }

  async getUser(userId: UserId): Promise<User> {
    const user = await this.collections.users.findOne({ email: userId });
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  async getUsersFromClass(clazz: Class, role: Role): Promise<User[]> {
    console.log({
      enrollment: {
        $elemMatch: {
          ...clazz,
          role,
        },
      },
    });
    const users = await this.collections.users
      .find({
        enrollment: {
          $elemMatch: {
            ...clazz,
            role,
          },
        },
      })
      .toArray();
    return users;
  }

  // async updateEnrollment(
  //   userId: UserId,
  //   enrollment: User["enrollment"],
  // ): Promise<void> {
  //   for (const inputCourse of enrollment) {
  //     const course = await this.collections.courses.findOne({
  //       code: inputCourse.code,
  //       term: inputCourse.term,
  //     });
  //     if (!course) throw CourseNotFound(inputCourse);
  //     for (const inputSection of inputCourse.sections) {
  //       if (
  //         !course.sections.map((course) => course.code).includes(inputSection)
  //       ) {
  //         throw SectionNotFound(inputCourse, inputSection);
  //       }
  //     }
  //   }
  //   const result = await this.collections.users.updateOne(
  //     { email: userId },
  //     { $set: { enrollment } },
  //   );
  //   if (result.modifiedCount === 0)
  //     throw new Error("Failed to update enrollment");
  // }

  async getUserRequests(userId: UserId): Promise<Request[]> {
    const result = await this.collections.requests
      .find({ from: userId })
      .toArray();
    return result.map((req) =>
      Request.parse({ ...req, id: req._id.toHexString() }),
    );
  }
}
