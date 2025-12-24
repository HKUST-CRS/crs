import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { DbConn } from "../db";
import { UserService } from "../lib";
import { ClassPermissionError } from "../lib/error";
import { createRepos } from "../repos";
import { UserNotFoundError } from "../repos/error";
import * as testData from "./testData";
import { clearData, insertTestData } from "./testUtils";

describe("UserService", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryServer;
  let userService: UserService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    conn = await DbConn.create(memoryServer.getUri());
    userService = new UserService(createRepos(conn.collections));
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await insertTestData(conn);
  });

  afterEach(async () => {
    await clearData(conn);
  });

  describe("getUser", () => {
    test("should get user by email", async () => {
      const user = testData.students[0];
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
    });
    test("should update user name successfully", async () => {
      const user = testData.students[0];
      await userService.auth(user.email).sync("New Name");
      const updatedUser = await userService.auth(user.email).getCurrentUser();
      expect(updatedUser.name).toBe("New Name");
    });
  });

  describe("getUsersFromClass", () => {
    test("instructors should have full access", async () => {
      const instructor = testData.instructors[0];
      const course = testData.courses[0];
      const students = await userService
        .auth(instructor.email)
        .getUsersFromClass({ course, section: "L1" }, "student");
      expect(students.length).toBeGreaterThan(0);
      const tas = await userService
        .auth(instructor.email)
        .getUsersFromClass({ course, section: "L1" }, "ta");
      expect(tas.length).toBeGreaterThan(0);
      const instructors = await userService
        .auth(instructor.email)
        .getUsersFromClass({ course, section: "L1" }, "instructor");
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("TAs should be able to view students in their class", async () => {
      const ta = testData.tas[0];
      const course = testData.courses[0];
      const students = await userService
        .auth(ta.email)
        .getUsersFromClass({ course, section: "L1" }, "student");
      expect(students.length).toBeGreaterThan(0);
    });

    test("students should only see instructors and TAs", async () => {
      const student = testData.students[0];
      const course = testData.courses[0];
      const tas = await userService
        .auth(student.email)
        .getUsersFromClass({ course, section: "L1" }, "ta");
      expect(tas.length).toBeGreaterThan(0);
      const instructors = await userService
        .auth(student.email)
        .getUsersFromClass({ course, section: "L1" }, "instructor");
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("students should not see other students", async () => {
      const student = testData.students[0];
      const course = testData.courses[0];
      try {
        await userService
          .auth(student.email)
          .getUsersFromClass({ course, section: "L1" }, "student");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("users not in class should not have access", async () => {
      const user = testData.students[1];
      const course = testData.courses[0];
      try {
        await userService
          .auth(user.email)
          .getUsersFromClass({ course, section: "L1" }, "instructor");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
