import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  CoursePermissionError,
  CourseService,
  UserNotFoundError,
} from "../lib";
import * as testData from "./testData";
import { TestConn } from "./testDb";

describe("CourseService", () => {
  let testConn: TestConn;
  let courseService: CourseService;

  beforeAll(async () => {
    testConn = await TestConn.create();
    courseService = new CourseService(testConn.collections);
  });

  afterAll(async () => {
    await testConn.close();
  });

  describe("getCourse", () => {
    test("should get course by id", async () => {
      const student = testData.students[0];
      const courseId = { code: "COMP 1023", term: "2510" };
      const course = await courseService.getCourse(student.email, courseId);
      expect(course.code).toEqual(courseId.code);
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await courseService.getCourse("dne@dne.com", {
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
        await courseService.getCourse(student.email, {
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
        await courseService.getCourse(student.email, {
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
      const courses = await courseService.getCoursesFromEnrollment(
        student.email,
      );
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
        await courseService.getCoursesFromEnrollment("dne@dne.com");
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
      await courseService.updateSections(user.email, courseId, newSections);
      const updatedCourse = await courseService.getCourse(user.email, courseId);
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
        await courseService.updateSections(user.email, courseId, newSections);
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
      await courseService.setEffectiveRequestTypes(
        user.email,
        courseId,
        newRequestTypes,
      );
      const updatedCourse = await courseService.getCourse(user.email, courseId);
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
        await courseService.setEffectiveRequestTypes(
          user.email,
          course,
          newRequestTypes,
        );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });
});
