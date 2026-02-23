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
import type { Course, User } from "../models";
import { createRepos } from "../repos";
import { UserNotFoundError } from "../repos/error";
import { UserService } from "../services";
import {
  ClassPermissionError,
  CoursePermissionError,
  PermissionError,
  SudoerPermissionError,
} from "../services/error";
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

  describe("getCurrentUser", () => {
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

  describe("getUser", () => {
    test("users should be able to get themselves", async () => {
      const user: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [],
        sudoer: false,
      };
      await insertData(conn, { users: [user] });

      const fetchedUser = await userService
        .auth(user.email)
        .getUser(user.email);
      expect(fetchedUser).toEqual(user);
    });

    test("instructors should be able to get users in the same course", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [{ role: "instructor", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L2" }],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, student] });

      const fetchedUser = await userService
        .auth(instructor.email)
        .getUser(student.email);
      expect(fetchedUser).toEqual(student);
    });

    test("students should not be able to get other users", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const student1: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student2: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [{ role: "student", course: courseID, section: "L2" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student1, student2] });

      try {
        await userService.auth(student1.email).getUser(student2.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("should throw user not found error when target user does not exist", async () => {
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [
          {
            role: "instructor",
            course: { code: "COMP 1023", term: "2510" },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor] });

      try {
        await userService.auth(instructor.email).getUser("dne@connect.ust.hk");
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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
            section: "*",
          },
          {
            role: "admin",
            course: { code: courseB.code, term: courseB.term },
            section: "*",
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

  describe("suggestUserName", () => {
    test("instructors can suggest name for users in their course", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [{ role: "instructor", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, student] });

      await userService
        .auth(instructor.email)
        .suggestUserName(student.email, "Student One");

      const updatedStudent = await userService
        .auth(student.email)
        .getCurrentUser();
      expect(updatedStudent.name).toBe("Student One");
    });

    test("should not overwrite existing user name", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [{ role: "instructor", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "Existing Name",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, student] });

      await userService
        .auth(instructor.email)
        .suggestUserName(student.email, "New Name");

      const updatedStudent = await userService
        .auth(student.email)
        .getCurrentUser();
      expect(updatedStudent.name).toBe("Existing Name");
    });

    test("students cannot suggest names for users", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const target: User = {
        email: "student2@connect.ust.hk",
        name: "",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student, target] });

      try {
        await userService
          .auth(student.email)
          .suggestUserName(target.email, "Target Name");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
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
      const courseID = { code: "COMP 1023", term: "2510" };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [{ role: "admin", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [admin, student] });

      const users = await userService
        .auth(admin.email)
        .getUsersInCourse(courseID);
      expect(users.map((u) => u.email)).toEqual(
        expect.arrayContaining([student.email]),
      );
    });

    test("students should not be able to view users in a course", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student] });

      try {
        await userService.auth(student.email).getUsersInCourse(courseID);
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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
          "Absent from Section": true,
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

    test("user with enrollment section * should have full access to all sections", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
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
            section: "*",
          },
        ],
        sudoer: false,
      };
      const studentL1: User = {
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
      const studentL2: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
          },
        ],
        sudoer: false,
      };

      await insertData(conn, { users: [instructor, studentL1, studentL2] });

      // Instructor in * should be able to see student in L1
      const usersInL1 = await userService
        .auth(instructor.email)
        .getUsersInClass(
          { course: { code: course.code, term: course.term }, section: "L1" },
          "student",
        );
      expect(usersInL1).toHaveLength(1);
      expect(usersInL1[0]?.email).toBe(studentL1.email);

      // Instructor in * should be able to see student in L2
      const usersInL2 = await userService
        .auth(instructor.email)
        .getUsersInClass(
          { course: { code: course.code, term: course.term }, section: "L2" },
          "student",
        );
      expect(usersInL2).toHaveLength(1);
      expect(usersInL2[0]?.email).toBe(studentL2.email);

      // Student in L1 should see instructor who is in *
      const instructorsInL1 = await userService
        .auth(studentL1.email)
        .getUsersInClass(
          { course: { code: course.code, term: course.term }, section: "L1" },
          "instructor",
        );
      expect(instructorsInL1).toHaveLength(1);
      expect(instructorsInL1[0]?.email).toBe(instructor.email);
    });
  });

  describe("getEnrollments", () => {
    test("should flatten section * into per-section enrollments", async () => {
      const course: Course = {
        code: "COMP 1023",
        term: "2510",
        title: "Python",
        sections: { L1: { schedule: [] }, L2: { schedule: [] } },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
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
            section: "*",
          },
        ],
        sudoer: false,
      };
      const studentL1: User = {
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
      const studentL2: User = {
        email: "student2@connect.ust.hk",
        name: "student2",
        enrollment: [
          {
            role: "student",
            course: { code: course.code, term: course.term },
            section: "L2",
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
            section: "*",
          },
        ],
        sudoer: false,
      };

      await insertData(conn, {
        users: [instructor, studentL1, studentL2, admin],
      });

      const enrollments = await userService
        .auth(instructor.email)
        .getEnrollments(["instructor"]);

      expect(enrollments).toHaveLength(2);
      expect(enrollments.map((e) => e.section)).toEqual(
        expect.arrayContaining(["L1", "L2"]),
      );
      expect(enrollments.map((e) => e.section)).not.toEqual(
        expect.arrayContaining(["*"]),
      );
      expect(enrollments.every((e) => e.role === "instructor")).toBe(true);
    });
  });

  describe("createEnrollment", () => {
    test("admins should be able to create enrollment for new user", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const admin: User = {
        email: "admin1@ust.hk",
        name: "admin1",
        enrollment: [{ role: "admin", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [admin] });

      await userService
        .auth(admin.email)
        .createEnrollment("new@connect.ust.hk", {
          role: "student",
          course: courseID,
          section: "L1",
        });

      const createdUser = await userService
        .auth("new@connect.ust.hk")
        .getCurrentUser();
      expect(createdUser.enrollment).toEqual(
        expect.arrayContaining([
          { role: "student", course: courseID, section: "L1" },
        ]),
      );
    });

    test("students should not be able to create enrollment", async () => {
      const courseID = { code: "COMP 1023", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [student] });

      try {
        await userService
          .auth(student.email)
          .createEnrollment("new@connect.ust.hk", {
            role: "student",
            course: courseID,
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
      const courseID = { code: "COMP 1023", term: "2510" };
      const instructor: User = {
        email: "instructor1@ust.hk",
        name: "instructor1",
        enrollment: [{ role: "instructor", course: courseID, section: "L1" }],
        sudoer: false,
      };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [{ role: "student", course: courseID, section: "L1" }],
        sudoer: false,
      };
      await insertData(conn, { users: [instructor, student] });

      await userService.auth(instructor.email).deleteEnrollment(student.email, {
        role: "student",
        course: courseID,
        section: "L1",
      });

      const updatedUser = await userService
        .auth(student.email)
        .getCurrentUser();
      expect(updatedUser.enrollment).toEqual([]);
    });
  });
});
