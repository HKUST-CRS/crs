import type { Class, Role, User, UserId } from "../models";
import { BaseFunctions } from "./base";

export class UserFunctions extends BaseFunctions {
  async updateUserName(userId: UserId, name: string): Promise<void> {
    await this.collections.users.updateOne(
      { email: userId },
      { $set: { name } },
    );
  }

  async getUsersFromClass(clazz: Class, role: Role): Promise<User[]> {
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
}
