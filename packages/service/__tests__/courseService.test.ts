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
import { UserNotFoundError } from "../functions/error";
import { CourseService } from "../lib";
import { CoursePermissionError } from "../lib/error";
import * as testData from "./testData";
import { clearData, insertTestData } from "./testUtils";

describe("CourseService", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryServer;
  let courseService: CourseService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    conn = await DbConn.create(memoryServer.getUri());
    courseService = new CourseService(conn.collections);
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

  describe("getCourse", () => {
    test("should get course by id", async () => {
      const student = testData.students[0];
      const courseId = { code: "COMP 1023", term: "2510" };
      const course = await courseService
        .withAuth(student.email)
        .getCourse(courseId);
      expect(course.code).toEqual(courseId.code);
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await courseService.withAuth("dne@dne.com").getCourse({
          code: "COMP1023",
          term: "2510",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });

    test("should throw permission error when user is not in the course", async () => {
      const student = testData.students[0];
      try {
        await courseService.withAuth(student.email).getCourse({
          code: "COMP 1023",
          term: "2530",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("should throw error when course does not exist", async () => {
      const student = testData.students[0];
      try {
        await courseService.withAuth(student.email).getCourse({
          code: "NONEXIST",
          term: "2510",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });

  describe("getCoursesFromEnrollment", () => {
    test("should get all courses from user's enrollment", async () => {
      const student = testData.students[0];
      const courses = await courseService
        .withAuth(student.email)
        .getCoursesFromEnrollment();
      expect(courses.length).toBe(1);
      const courseCodes = courses.map((course) => course.code);
      const enrollmentCourseCodes = student.enrollment.map(
        (enroll) => enroll.course.code,
      );
      expect(courseCodes).toEqual(
        expect.arrayContaining(enrollmentCourseCodes),
      );
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await courseService.withAuth("dne@dne.com").getCoursesFromEnrollment();
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });
  });

  describe("updateSections", () => {
    test("should update course sections successfully", async () => {
      const user = testData.instructors[0];
      const course = testData.courses[0];
      const courseId = { code: course.code, term: course.term };
      const newSections = { ...course.sections, L3: { schedule: [] } };
      await courseService
        .withAuth(user.email)
        .updateSections(courseId, newSections);
      const updatedCourse = await courseService
        .withAuth(user.email)
        .getCourse(courseId);
      expect(Object.keys(updatedCourse.sections).length).toBe(
        Object.keys(course.sections).length + 1,
      );
    });

    test("should throw permission error when user is not instructor", async () => {
      const user = testData.students[0];
      const course = testData.courses[0];
      const courseId = { code: course.code, term: course.term };
      const newSections = { ...course.sections, L3: { schedule: [] } };
      try {
        await courseService
          .withAuth(user.email)
          .updateSections(courseId, newSections);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });

  describe("setEffectiveRequestTypes", () => {
    test("should update effective request types successfully", async () => {
      const user = testData.instructors[0];
      const course = testData.courses[0];
      const courseId = { code: course.code, term: course.term };
      const newRequestTypes = {
        "Swap Section": false,
        "Deadline Extension": true,
      };
      await courseService
        .withAuth(user.email)
        .setEffectiveRequestTypes(courseId, newRequestTypes);
      const updatedCourse = await courseService
        .withAuth(user.email)
        .getCourse(courseId);
      expect(updatedCourse.effectiveRequestTypes).toEqual(newRequestTypes);
    });

    test("should throw permission error when user is not instructor", async () => {
      const user = testData.students[0];
      const course = testData.courses[0];
      const newRequestTypes = {
        "Swap Section": false,
        "Deadline Extension": true,
      };
      try {
        await courseService
          .withAuth(user.email)
          .setEffectiveRequestTypes(course, newRequestTypes);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });
});
