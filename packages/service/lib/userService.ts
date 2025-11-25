import {
  type Class,
  Request,
  type Role,
  type User,
  type UserId,
} from "../models";
import { assertAck, BaseService } from "./baseService";
import { assertClassRole } from "./permission";

export class UserService extends BaseService {
  async createUser(data: User): Promise<void> {
    const result = await this.collections.users.insertOne(data);
    assertAck(result, `create user ${JSON.stringify(data)}`);
  }

  async getUser(uid: UserId): Promise<User> {
    return this.requireUser(uid);
  }

  async updateUserName(uid: UserId, name: string): Promise<void> {
    await this.collections.users.updateOne({ email: uid }, { $set: { name } });
  }

  /** For internal use of the service package only */
  async _getUsersFromClassInternal(clazz: Class, role: Role): Promise<User[]> {
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

  async getUsersFromClass(
    uid: UserId,
    clazz: Class,
    role: Role,
  ): Promise<User[]> {
    const user = await this.requireUser(uid);
    if (role === "student") {
      // only instructors/TAs in the class can view the students
      assertClassRole(
        user,
        clazz,
        ["instructor", "ta"],
        `viewing students in class ${clazz.course.code} (${clazz.course.term})`,
      );
    } else {
      // only people in the class can view the instructors/TAs
      assertClassRole(
        user,
        clazz,
        ["student", "instructor", "ta"],
        `viewing instructors/TAs in class ${clazz.course.code} (${clazz.course.term})`,
      );
    }
    return this._getUsersFromClassInternal(clazz, role);
  }

  async getUserRequests(userId: UserId): Promise<Request[]> {
    const result = await this.collections.requests
      .find({ from: userId })
      .toArray();
    return result.map((req) =>
      Request.parse({ ...req, id: req._id.toHexString() }),
    );
  }
}
