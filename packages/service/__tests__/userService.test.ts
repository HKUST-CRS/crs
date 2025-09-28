import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  CourseNotFound,
  CourseService,
  SectionNotFound,
  UserNotFound,
  UserService,
} from "../lib";
import type { Course, User } from "../models";
import { MockDataGenerator } from "./mockData";
import { getTestConn, type TestConn } from "./testDb";

describe("UserService", () => {
  let testConn: TestConn;
  let mockDataGen: MockDataGenerator;
  let userService: UserService;
  let courseService: CourseService;

  let user: User;
  let userId: User["email"];

  beforeAll(async () => {
    testConn = await getTestConn();
    mockDataGen = new MockDataGenerator();
    const collections = await testConn.getCollections();
    userService = new UserService(collections);
    courseService = new CourseService(collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  beforeEach(async () => {
    await testConn.clear();
    user = mockDataGen.makeNewUser();
    userId = user.email;
  });

  describe("createUser", () => {
    test("should create a student user successfully", async () => {
      await userService.createUser(user);
    });
  });

  describe("getUser", () => {
    test("should get user by email", async () => {
      await userService.createUser(user);
      const foundUser = await userService.getUser(userId);
      expect(foundUser).toEqual(user);
    });

    test("should throw error when user not found", async () => {
      // user not created in the database
      try {
        await userService.getUser(userId);
        expect.unreachable("Should have thrown an error");
      } catch (error) {
        const errorMessage = UserNotFound(userId).message;
        expect((error as Error).message).toBe(errorMessage);
      }
    });
  });

  describe("updateEnrollment", () => {
    let course: Course;
    let userInDb: User;
    let userInDbId: User["email"];

    beforeEach(async () => {
      await userService.createUser(user);
      userInDb = await userService.getUser(userId);
      userInDbId = userInDb.email;
      course = mockDataGen.makeNewCourse();
    });

    test("should update user enrollment successfully", async () => {
      await courseService.createCourse(course);
      const enrollment: User["enrollment"] = [
        {
          code: course.code,
          term: course.term,
          role: "student",
          sections: ["L1", "T1"],
        },
      ];
      await userService.updateEnrollment(userInDbId, enrollment);
      const updatedUser = await userService.getUser(userInDbId);
      expect(updatedUser.enrollment).toEqual(enrollment);
    });

    test("should reject non-existing course and throw an error", async () => {
      // course not created in the database
      const enrollment: User["enrollment"] = [
        {
          code: course.code,
          term: course.term,
          role: "student",
          sections: ["L1"],
        },
      ];
      try {
        await userService.updateEnrollment(userInDbId, enrollment);
        expect.unreachable("Should have thrown an error");
      } catch (error) {
        const errorMessage = CourseNotFound(course).message;
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    test("should reject non-existing section and throw an error", async () => {
      await courseService.createCourse(course);
      const enrollment: User["enrollment"] = [
        {
          code: course.code,
          term: course.term,
          role: "student",
          sections: ["L1", "DNE"],
        },
      ];
      try {
        await userService.updateEnrollment(userInDbId, enrollment);
        expect.unreachable("Should have thrown an error");
      } catch (error) {
        const errorMessage = SectionNotFound(course, "DNE").message;
        expect((error as Error).message).toBe(errorMessage);
      }
    });
  });
});
