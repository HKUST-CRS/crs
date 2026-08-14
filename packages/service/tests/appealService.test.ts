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
import { AppealAlreadyExistsError } from "../repos/error";
import { AppealService } from "../services";
import {
  AppealPermissionError,
  AssignmentNotFoundError,
  AssignmentNotGradedError,
} from "../services/error";
import { clearData, insertData } from "./tests";

describe("AppealService", () => {
  let testConn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let appealService: AppealService;

  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    testConn = await DbConn.create(memoryServer.getUri());
    appealService = new AppealService(createRepos(testConn.collections));
  });

  afterAll(async () => {
    await testConn.close();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await clearData(testConn);
  });

  afterEach(async () => {
    await clearData(testConn);
  });

  function gradedCourse(): Course {
    return {
      code: "COMP 1023",
      term: "2510",
      title: "Python",
      sections: {
        L1: { schedule: [], type: "Lecture", lecturers: ["lecturer1@ust.hk"] },
        T1: { schedule: [] },
      },
      assignments: {
        A1: {
          name: "Assignment 1",
          due: "2025-11-28T23:59:00+08:00",
          maxExtension: "P7D",
          tas: ["ta1@ust.hk"],
          state: "graded",
        },
      },
      effectiveRequestTypes: {
        "Swap Section": true,
        "Absent from Section": true,
        "Deadline Extension": true,
      },
    };
  }

  const student: User = {
    email: "student1@connect.ust.hk",
    name: "student1",
    enrollment: [
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "L1",
      },
    ],
    sudoer: false,
  };
  const ta: User = {
    email: "ta1@ust.hk",
    name: "ta1",
    enrollment: [],
    sudoer: false,
  };
  const lecturer: User = {
    email: "lecturer1@ust.hk",
    name: "lecturer1",
    enrollment: [],
    sudoer: false,
  };
  const otherStudent: User = {
    email: "student2@connect.ust.hk",
    name: "student2",
    enrollment: [
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "L1",
      },
    ],
    sudoer: false,
  };

  describe("createAppeal", () => {
    test("creates an appeal with frozen participants and the opening message", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.participants).toEqual([
        "student1@connect.ust.hk",
        "ta1@ust.hk",
        "lecturer1@ust.hk",
      ]);
      expect(appeal.state).toBe("open");
      expect(appeal.closedAt).toBeNull();
      expect(appeal.messages).toHaveLength(1);
      expect(appeal.messages[0]?.content).toBe("I think my grade is wrong");
    });

    test("throws AssignmentNotFoundError when the assignment does not exist", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      try {
        await appealService
          .auth(student.email)
          .createAppeal(
            { course: { code: "COMP 1023", term: "2510" }, assignment: "A2" },
            { content: "This assignment doesn't exist" },
          );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AssignmentNotFoundError);
      }
    });

    test("throws AssignmentNotGradedError when the assignment is not graded", async () => {
      const notGraded = gradedCourse();
      const assignment = notGraded.assignments.A1;
      if (assignment) {
        assignment.state = "open";
      }
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [notGraded],
      });

      try {
        await appealService
          .auth(student.email)
          .createAppeal(
            { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
            { content: "Can't appeal an ungraded assignment" },
          );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AssignmentNotGradedError);
      }
    });

    test("throws AppealAlreadyExistsError when the appeal already exists", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });
      await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "First appeal" },
        );

      try {
        await appealService
          .auth(student.email)
          .createAppeal(
            { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
            { content: "Second appeal" },
          );
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealAlreadyExistsError);
      }
    });

    test("throws AppealPermissionError when the user is not a student in the course", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      try {
        await appealService.auth(otherStudent.email).getAppeal(appealID);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealPermissionError);
      }
    });
  });

  describe("postMessage", () => {
    test("a participant can post a message", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      await appealService.auth(ta.email).postMessage(appealID, {
        content: "Let me check the grading rubric.",
      });

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.messages).toHaveLength(2);
      expect(appeal.messages[1]?.content).toBe(
        "Let me check the grading rubric.",
      );
      expect(appeal.messages[1]?.from).toBe("ta1@ust.hk");
    });

    test("throws AppealPermissionError when a non-participant posts", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      try {
        await appealService.auth(otherStudent.email).postMessage(appealID, {
          content: "Let me in",
        });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealPermissionError);
      }
    });
  });
  describe("getAppealHeads", () => {
    test("returns only the user's own appeals", async () => {
      await insertData(testConn, {
        users: [student, ta, lecturer, otherStudent],
        courses: [gradedCourse()],
      });

      const myAppealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      await appealService
        .auth(otherStudent.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "My grade is also wrong" },
        );

      const heads = await appealService.auth(student.email).getAppealHeads();
      expect(heads).toHaveLength(1);
      expect(heads[0]?.id).toBe(myAppealID);
    });
  });
});
