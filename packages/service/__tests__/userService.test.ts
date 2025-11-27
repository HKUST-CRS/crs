/** biome-ignore-all lint/style/noNonNullAssertion: test data is fixed and safe */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ClassPermissionError, UserNotFoundError, UserService } from "../lib";
import * as testData from "./testData";
import { TestConn } from "./testDb";

describe("UserService", () => {
  let testConn: TestConn;
  let userService: UserService;

  beforeAll(async () => {
    testConn = await TestConn.create();
    userService = new UserService(testConn.collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  describe("getUser", () => {
    test("should get user by email", async () => {
      const user = testData.students[0];
      const fetchedUser = await userService.getUser(user.email);
      expect(fetchedUser.email).toBe(user.email);
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await userService.getUser("dne@dne.com");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });
  });

  describe("updateUserName", () => {
    test("should update user name successfully", async () => {
      const user = testData.students[0];
      await userService.updateUserName(user.email, "New Name");
      const updatedUser = await userService.getUser(user.email);
      expect(updatedUser.name).toBe("New Name");
    });
  });

  describe("getUsersFromClass", () => {
    test("instructors should have full access", async () => {
      const instructor = testData.instructors[0];
      const course = testData.courses[0];
      const students = await userService.getUsersFromClass(
        instructor.email,
        { course, section: "L1" },
        "student",
      );
      expect(students.length).toBeGreaterThan(0);
      const tas = await userService.getUsersFromClass(
        instructor.email,
        { course, section: "L1" },
        "ta",
      );
      expect(tas.length).toBeGreaterThan(0);
      const instructors = await userService.getUsersFromClass(
        instructor.email,
        { course, section: "L1" },
        "instructor",
      );
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("TAs should be able to view students in their class", async () => {
      const ta = testData.tas[0];
      const course = testData.courses[0];
      const students = await userService.getUsersFromClass(
        ta.email,
        { course, section: "L1" },
        "student",
      );
      expect(students.length).toBeGreaterThan(0);
    });

    test("students should only see instructors and TAs", async () => {
      const student = testData.students[0];
      const course = testData.courses[0];
      const tas = await userService.getUsersFromClass(
        student.email,
        { course, section: "L1" },
        "ta",
      );
      expect(tas.length).toBeGreaterThan(0);
      const instructors = await userService.getUsersFromClass(
        student.email,
        { course, section: "L1" },
        "instructor",
      );
      expect(instructors.length).toBeGreaterThan(0);
    });

    test("students should not see other students", async () => {
      const student = testData.students[0];
      const course = testData.courses[0];
      try {
        await userService.getUsersFromClass(
          student.email,
          { course, section: "L1" },
          "student",
        );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("users not in class should not have access", async () => {
      const user = testData.students[1];
      const course = testData.courses[0];
      try {
        await userService.getUsersFromClass(
          user.email,
          { course, section: "L1" },
          "instructor",
        );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });
});
