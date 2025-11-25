import type { Class, Role, User, UserId } from "../models";
import { BaseService } from "./baseService";
import { assertClassRole } from "./permission";

export class UserService extends BaseService {
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
            "course.code": clazz.course.code,
            "course.term": clazz.course.term,
            section: clazz.section,
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
}
