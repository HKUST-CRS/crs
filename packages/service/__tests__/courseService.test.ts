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
import { CourseService } from "../lib";
import { CoursePermissionError } from "../lib/error";
import type { Course, User } from "../models";
import { createRepos } from "../repos";
import { CourseNotFoundError, UserNotFoundError } from "../repos/error";
import { clearData, insertData } from "./tests";

describe("CourseService", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryServer;
  let courseService: CourseService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryServer.create();
    conn = await DbConn.create(memoryServer.getUri());
    courseService = new CourseService(createRepos(conn.collections));
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

  describe("getCourse", () => {
    test("should get course by id", async () => {
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
      };

      await insertData(conn, { users: [student], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const courseResult = await courseService
        .auth(student.email)
        .getCourse(courseId);
      expect(courseResult.code).toEqual(courseId.code);
    });

    test("admins should be able to get course by id", async () => {
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
      };

      await insertData(conn, { users: [admin], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const courseResult = await courseService
        .auth(admin.email)
        .getCourse(courseId);
      expect(courseResult.code).toEqual(courseId.code);
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await courseService.auth("dne@dne.com").getCourse({
          code: "COMP 1023",
          term: "2510",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });

    test("should throw permission error when user is not in the course", async () => {
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
      };
      await insertData(conn, { users: [student] });

      try {
        await courseService.auth(student.email).getCourse({
          code: "COMP 1023",
          term: "2530",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("should throw error when course does not exist but user is enrolled", async () => {
      const courseId = { code: "NONEXIST", term: "2510" };
      const student: User = {
        email: "student1@connect.ust.hk",
        name: "student1",
        enrollment: [
          {
            role: "student",
            course: courseId,
            section: "L1",
          },
        ],
      };
      await insertData(conn, { users: [student] });

      try {
        await courseService.auth(student.email).getCourse(courseId);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CourseNotFoundError);
      }
    });
  });

  describe("getCoursesFromEnrollment", () => {
    test("should get all courses from user's enrollment", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const courses = await courseService
        .auth(student.email)
        .getCoursesFromEnrollment(["student"]);
      expect(courses.length).toBe(1);
      const courseCodes = courses.map((c) => c.code);
      const enrollmentCourseCodes = student.enrollment.map(
        (e) => e.course.code,
      );
      expect(courseCodes).toEqual(
        expect.arrayContaining(enrollmentCourseCodes),
      );
    });

    test("should throw user not found error when user does not exist", async () => {
      try {
        await courseService
          .auth("dne@dne.com")
          .getCoursesFromEnrollment(["student"]);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(UserNotFoundError);
      }
    });

    test("should return empty when no roles match", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const courses = await courseService
        .auth(student.email)
        .getCoursesFromEnrollment(["admin"]);
      expect(courses.length).toBe(0);
    });

    test("should return empty when roles list is empty", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const courses = await courseService
        .auth(student.email)
        .getCoursesFromEnrollment([]);
      expect(courses.length).toBe(0);
    });
  });

  describe("updateSections", () => {
    test("should update course sections successfully", async () => {
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
      };
      await insertData(conn, { users: [instructor], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newSections = { ...course.sections, L3: { schedule: [] } };
      await courseService
        .auth(instructor.email)
        .updateSections(courseId, newSections);
      const updatedCourse = await courseService
        .auth(instructor.email)
        .getCourse(courseId);
      expect(Object.keys(updatedCourse.sections).length).toBe(
        Object.keys(course.sections).length + 1,
      );
    });

    test("should throw permission error when user is not instructor", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newSections = { ...course.sections, L3: { schedule: [] } };
      try {
        await courseService
          .auth(student.email)
          .updateSections(courseId, newSections);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("admins should be able to update course sections", async () => {
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
      };
      await insertData(conn, { users: [admin], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newSections = { ...course.sections, L3: { schedule: [] } };
      await courseService
        .auth(admin.email)
        .updateSections(courseId, newSections);
      const updatedCourse = await courseService
        .auth(admin.email)
        .getCourse(courseId);
      expect(Object.keys(updatedCourse.sections)).toContain("L3");
    });
  });

  describe("updateEffectiveRequestTypes", () => {
    test("should update effective request types successfully", async () => {
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
      };
      await insertData(conn, { users: [instructor], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newRequestTypes = {
        "Swap Section": false,
        "Deadline Extension": true,
      };
      await courseService
        .auth(instructor.email)
        .updateEffectiveRequestTypes(courseId, newRequestTypes);
      const updatedCourse = await courseService
        .auth(instructor.email)
        .getCourse(courseId);
      expect(updatedCourse.effectiveRequestTypes).toEqual(newRequestTypes);
    });

    test("should throw permission error when user is not instructor", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const newRequestTypes = {
        "Swap Section": false,
        "Deadline Extension": true,
      };
      try {
        await courseService
          .auth(student.email)
          .updateEffectiveRequestTypes(course, newRequestTypes);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("admins should be able to update effective request types", async () => {
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
      };
      await insertData(conn, { users: [admin], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newRequestTypes = {
        "Swap Section": false,
        "Deadline Extension": true,
      };
      await courseService
        .auth(admin.email)
        .updateEffectiveRequestTypes(courseId, newRequestTypes);
      const updatedCourse = await courseService
        .auth(admin.email)
        .getCourse(courseId);
      expect(updatedCourse.effectiveRequestTypes).toEqual(newRequestTypes);
    });
  });

  describe("updateAssignments", () => {
    test("admins should be able to update assignments", async () => {
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
      };
      await insertData(conn, { users: [admin], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newAssignments = {
        Lab1: {
          name: "Lab 1",
          due: "2025-12-01T00:00:00.000+00:00",
          maxExtension: "PT24H",
        },
      };

      await courseService
        .auth(admin.email)
        .updateAssignments(courseId, newAssignments);
      const updatedCourse = await courseService
        .auth(admin.email)
        .getCourse(courseId);
      expect(updatedCourse.assignments).toEqual(newAssignments);
    });

    test("students should not be able to update assignments", async () => {
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
      };
      await insertData(conn, { users: [student], courses: [course] });

      const courseId = { code: course.code, term: course.term };
      const newAssignments = {
        Lab1: {
          name: "Lab 1",
          due: "2025-12-01T00:00:00.000+00:00",
          maxExtension: "PT24H",
        },
      };

      try {
        await courseService
          .auth(student.email)
          .updateAssignments(courseId, newAssignments);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });
  });
});
