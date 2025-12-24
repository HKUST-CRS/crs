import type { Class, Role, User, UserId } from "../models";
import type { Repos } from "../repos";
import { assertClassRole } from "./permission";

export class UserService<TUser extends UserId | null = null> {
  public user: TUser;

  constructor(repos: Repos);
  constructor(repos: Repos, user: TUser);
  constructor(
    private repos: Repos,
    user?: TUser,
  ) {
    this.user = (user ?? null) as TUser;
  }

  auth(this: UserService<null>, user: string): UserService<string> {
    return new UserService(this.repos, user);
  }

  /**
   * Synchronize the current user.
   *
   * It updates the user's name according to the latest info.
   *
   * If the user does not exist, it creates the user record.
   */
  async sync(this: UserService<UserId>, name: string): Promise<void> {
    await this.repos.user.createUser(this.user);
    await this.repos.user.updateUserName(this.user, name);
  }

  async getCurrentUser(this: UserService<UserId>): Promise<User> {
    return this.repos.user.requireUser(this.user);
  }

  async getUsersFromClass(
    this: UserService<UserId>,
    clazz: Class,
    role: Role,
  ): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.user);
    if (role === "student") {
      // only instructors and TAs in the class can view the students
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
    return this.repos.user.getUsersFromClass(clazz, role);
  }
}
