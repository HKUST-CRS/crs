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

  async createUser(userId: UserId): Promise<User> {
    const newUser: User = {
      email: userId,
      name: "",
      enrollment: [],
    };
    await this.collections.users.insertOne(newUser);
    return newUser;
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
