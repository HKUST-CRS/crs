import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import { UserService } from "../lib";
import {
  ClassPermissionError,
  CoursePermissionError,
  SudoerPermissionError,
} from "../lib/error";
import type { Course, User } from "../models";
import { createRepos } from "../repos";
import { UserNotFoundError } from "../repos/error";
import { clearData, insertData } from "./tests";

describe("UserService", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let userService: UserService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    conn = await DbConn.create(memoryServer.getUri());
    userService = new UserService(createRepos(conn.collections));
  });

  afterAll(async () => {
    await conn.close();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await clearData(conn);
  });

  afterEach(async () => {
    await clearData(conn);
  });

  describe("getUser", () => {
    test("should get user by email", async () => {
      const user: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [],
        sudoer: false,
      };
      await insertData(conn, { users: [user] });
      const fetchedUser = await userService.auth(user.email).getCurrentUser();
      expect(fetchedUser.email).toBe(user.email);
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await userService.auth("dne@dne.com").getCurrentUser();
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });
  });

  describe("sync", () => {
    test("should create user successfully", async () => {
      await userService.auth("42@connect.ust.hk").sync("42");
      const user = await userService.auth("42@connect.ust.hk").getCurrentUser();
      expect(user.email).toBe("42@connect.ust.hk");
      expect(user.name).toBe("42");
      expect(user.enrollment).toEqual([]);
      expect(user.sudoer).toBeFalsy();
    });
    test("should update user name successfully", async () => {
      const user: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [],
        sudoer: false,
      };
      await insertData(conn, { users: [user] });
      await userService.auth(user.email).sync("New Name");
      const updatedUser = await userService.auth(user.email).getCurrentUser();
      expect(updatedUser.name).toBe("New Name");
    });

    test("sudoer sync should enforce admin enrollment across courses", async () => {
      const courseA: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const courseB: Course = {
        code: "COMP 2011",
        term: "2510",
        title: "Programming",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const sudoer: User = {
        email: "sudoer1@ust.hk",
        name: "sudoer1",
        enrollment: [
          {
            role: "admin",
            course: { code: courseA.code, term: courseA.term },
            section: "L1",
          },
        ],
        sudoer: true,
      };
      await insertData(conn, { users: [sudoer], courses: [courseA, courseB] });

      await userService.auth(sudoer.email).sync("sudoer1");
      const updatedUser = await userService.auth(sudoer.email).getCurrentUser();

      expect(updatedUser.enrollment).toEqual(
        expect.arrayContaining([
          {
            role: "admin",
            course: { code: courseA.code, term: courseA.term },
            section: "(as system admin)",
          },
          {
            role: "admin",
            course: { code: courseB.code, term: courseB.term },
            section: "(as system admin)",
          },
        ]),
      );
      expect(
        updatedUser.enrollment.some(
          (e) =>
            e.course.code === courseA.code &&
            e.course.term === courseA.term &&
            e.section === "L1",
        ),
      ).toBe(false);
    });
  });

  describe("getSudoers", () => {
    test("sudoers should be able to list sudoers", async () => {
      const sudoer: User = {
        email: "sudoer1@ust.hk",
        name: "sudoer1",
        enrollment: [],
        sudoer: true,
      };
      const nonSudoer: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [],
        sudoer: false,
      };
      await insertData(conn, { users: [sudoer, nonSudoer] });

      const sudoers = await userService.auth(sudoer.email).getSudoers();
      expect(sudoers.map((u) => u.email)).toEqual(
        expect.arrayContaining([sudoer.email]),
      );
      expect(sudoers.map((u) => u.email)).not.toEqual(
        expect.arrayContaining([nonSudoer.email]),
      );
    });

    test("non-sudoers should not be able to list sudoers", async () => {
      const sudoer: User = {
        email: "sudoer1@ust.hk",
        name: "sudoer1",
        enrollment: [],
        sudoer: true,
      };
      const nonSudoer: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [],
        sudoer: false,
      };
      await insertData(conn, { users: [sudoer, nonSudoer] });

      try {
        await userService.auth(nonSudoer.email).getSudoers();
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(SudoerPermissionError);
      }
    });
  });

  describe("getUsersInCourse", () => {
    test("admins should be able to view users in a course", async () => {
      const courseId = { code: "COMP 1023", term: "2510" };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [{ role: "admin", course: courseId, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseId, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [admin, student] });

      const users = await userService
        .auth(admin.email)
        .getUsersInCourse(courseId);
      expect(users.map((u) => u.email)).toEqual(
        expect.arrayContaining([student.email]),
      );
    });

    test("students should not be able to view users in a course", async () => {
      const courseId = { code: "COMP 1023", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseId, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student] });

      try {
        await userService.auth(student.email).getUsersInCourse(courseId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });

  describe("getUsersInClass", () => {
    test("instructors should have full access", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const observer: User = {
        email: "observer1@connect.ust.hk",
        name: "observer1",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, observer, student] });
      const students = await userService
        .auth(instructor.email)
        .getUsersInClass({ course, section: "L1" }, "student");
      expect(students.length).toBeGreaterThan(0);
      const observers = await userService
        .auth(instructor.email)
        .getUsersInClass({ course, section: "L1" }, "observer");
      expect(observers.length).toBeGreaterThan(0);
      const instructors = await userService
        .auth(instructor.email)
        .getUsersInClass({ course, section: "L1" }, "instructor");
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("observers should not be able to view students in their class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const observer: User = {
        email: "observer1@connect.ust.hk",
        name: "observer1",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [observer, student] });
      try {
        await userService
          .auth(observer.email)
          .getUsersInClass({ course, section: "L1" }, "student");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("students should only see instructors and observers", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const observer: User = {
        email: "observer1@connect.ust.hk",
        name: "observer1",
        enrollment: [
          {
            role: "observer",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [student, observer, instructor] });
      const observers = await userService
        .auth(student.email)
        .getUsersInClass({ course, section: "L1" }, "observer");
      expect(observers.length).toBeGreaterThan(0);
      const instructors = await userService
        .auth(student.email)
        .getUsersInClass({ course, section: "L1" }, "instructor");
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("students should not see other students", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const otherStudent: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [student, otherStudent] });
      try {
        await userService
          .auth(student.email)
          .getUsersInClass({ course, section: "L1" }, "student");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("users not in class should not have access", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const user: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [],
        sudoer: false,
      };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [user, instructor] });
      try {
        await userService
          .auth(user.email)
          .getUsersInClass({ course, section: "L1" }, "instructor");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("students should be able to view admins in their class", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [
          {
            role: "admin",
            course: { code: course.code, term: course.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [student, admin] });

      const admins = await userService
        .auth(student.email)
        .getUsersInClass({ course, section: "L1" }, "admin");
      expect(admins.map((u) => u.email)).toEqual(
        expect.arrayContaining([admin.email]),
      );
    });
  });

  describe("createEnrollment", () => {
    test("admins should be able to create enrollment for new user", async () => {
      const courseId = { code: "COMP 1023", term: "2510" };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [{ role: "admin", course: courseId, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [admin] });

      await userService
        .auth(admin.email)
        .createEnrollment("new@connect.ust.hk", {
          role: "student",
          course: courseId,
          section: "L1",
        });

      const createdUser = await userService
        .auth("new@connect.ust.hk")
        .getCurrentUser();
      expect(createdUser.enrollment).toEqual(
        expect.arrayContaining([
          { role: "student", course: courseId, section: "L1" },
        ]),
      );
    });

    test("students should not be able to create enrollment", async () => {
      const courseId = { code: "COMP 1023", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseId, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student] });

      try {
        await userService
          .auth(student.email)
          .createEnrollment("new@connect.ust.hk", {
            role: "student",
            course: courseId,
            section: "L1",
          });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });

  describe("deleteEnrollment", () => {
    test("instructors should be able to delete enrollment", async () => {
      const courseId = { code: "COMP 1023", term: "2510" };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [{ role: "instructor", course: courseId, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseId, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, student] });

      await userService.auth(instructor.email).deleteEnrollment(student.email, {
        role: "student",
        course: courseId,
        section: "L1",
      });

      const updatedUser = await userService
        .auth(student.email)
        .getCurrentUser();
      expect(updatedUser.enrollment).toEqual([]);
    });
  });
});
