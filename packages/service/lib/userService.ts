import type { Class, Role, User, UserId } from "../models";
import { AuthableService, ServiceWithAuth } from "./baseService";
import { assertClassRole } from "./permission";

export class UserService extends AuthableService {
  withAuth(userId: UserId): UserServiceWithAuth {
    return new UserServiceWithAuth(this.repos, userId);
  }
}

class UserServiceWithAuth extends ServiceWithAuth {
  async getCurrentUser(): Promise<User> {
    return this.repos.user.requireUser(this.userId);
  }

  async updateUserName(name: string): Promise<void> {
    await this.repos.user.updateUserName(this.userId, name);
  }

  async getUsersFromClass(clazz: Class, role: Role): Promise<User[]> {
    const user = await this.repos.user.requireUser(this.userId);
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
