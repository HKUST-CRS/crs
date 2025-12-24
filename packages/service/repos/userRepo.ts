import type { Collections } from "../db";
import type { Class, Role, User, UserId } from "../models";
import { UserNotFoundError } from "./error";

export class UserRepo {
  constructor(protected collections: Collections) {}

  async getUser(userId: UserId): Promise<User | null> {
    const user = await this.collections.users.findOne({ email: userId });
    return user;
  }

  async requireUser(userId: UserId): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new UserNotFoundError(userId);
    return user;
  }

  /**
   * Create a new user if not exists.
   *
   * The user's name is initialized as an empty string, and enrollment as an empty array.
   */
  async createUser(userId: UserId): Promise<void> {
    await this.collections.users.updateOne(
      {
        email: userId,
      },
      {
        $setOnInsert: {
          email: userId,
          name: "",
          enrollment: [],
        },
      },
    );
  }

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
