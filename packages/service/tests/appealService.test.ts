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
  AppealClosedError,
  AppealClosePendingError,
  AppealCloseRequestNotFoundError,
  AppealCloseRequiresStudentError,
  AppealParticipantExistsError,
  AppealPermissionError,
  AssignmentNotFoundError,
  AssignmentNotGradedError,
  CoursePermissionError,
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
  const instructor: User = {
    email: "instructor1@ust.hk",
    name: "instructor1",
    enrollment: [
      {
        role: "instructor",
        course: { code: "COMP 1023", term: "2510" },
        section: "*",
      },
    ],
    sudoer: false,
  };
  const observer: User = {
    email: "observer1@ust.hk",
    name: "observer1",
    enrollment: [
      {
        role: "observer",
        course: { code: "COMP 1023", term: "2510" },
        section: "*",
      },
    ],
    sudoer: false,
  };

  /**
   * A course whose lecture section is taught by `instructor`, so the
   * instructor is a participant of any appeal opened for it.
   */
  const instructorCourse = (): Course => {
    return {
      ...gradedCourse(),
      sections: {
        L1: {
          schedule: [],
          type: "Lecture",
          lecturers: ["instructor1@ust.hk"],
        },
        T1: { schedule: [] },
      },
    };
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
      expect(appeal.messages[0]?.role).toBe("student");
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

    test("stamps the sender's role in the course at post time", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      // The opening message is posted by the student, so it is stamped "student".
      const created = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(created.messages[0]?.role).toBe("student");

      // An instructor participant's message is stamped "instructor".
      await appealService
        .auth(instructor.email)
        .postMessage(appealID, { content: "I'll take a look." });
      const updated = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(updated.messages[1]?.from).toBe("instructor1@ust.hk");
      expect(updated.messages[1]?.role).toBe("instructor");

      // The TA has no course enrollment but is a TA of the assignment, so the
      // message is stamped with the TA role.
      await appealService
        .auth(ta.email)
        .postMessage(appealID, { content: "Let me check the rubric." });
      const final = await appealService.auth(student.email).getAppeal(appealID);
      expect(final.messages[2]?.from).toBe("ta1@ust.hk");
      expect(final.messages[2]?.role).toBe("ta");
    });

    test("stamps instructor when the appealing student's enrollment changes", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );

      // Simulate the single-account testing flow: after creating the appeal as
      // a student, the account's enrollment is edited to instructor in the DB.
      // Just for testing
      await testConn.collections.users.updateOne(
        { email: student.email },
        {
          $set: {
            enrollment: [
              {
                role: "instructor",
                course: { code: "COMP 1023", term: "2510" },
                section: "*",
              },
            ],
          },
        },
      );

      await appealService
        .auth(student.email)
        .postMessage(appealID, { content: "Now I am the instructor" });

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.messages[1]?.role).toBe("instructor");
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

  describe("getAppealParticipants", () => {
    test("returns every participant with email, name, and role", async () => {
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

      const participants = await appealService
        .auth(student.email)
        .getAppealParticipants(appealID);
      expect(participants).toEqual([
        { email: "student1@connect.ust.hk", name: "student1", role: "student" },
        { email: "ta1@ust.hk", name: "ta1", role: "ta" },
        { email: "lecturer1@ust.hk", name: "lecturer1", role: "lecturer" },
      ]);
    });

    test("resolves enrolled staff and invited observers from their course role", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer],
        courses: [instructorCourse()],
      });

      const appealID = await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );
      await appealService
        .auth(instructor.email)
        .inviteParticipant(appealID, observer.email);

      const participants = await appealService
        .auth(student.email)
        .getAppealParticipants(appealID);
      expect(participants).toHaveLength(4);
      const rolesByEmail = new Map(participants.map((p) => [p.email, p.role]));
      expect(rolesByEmail.get("student1@connect.ust.hk")).toBe("student");
      expect(rolesByEmail.get("ta1@ust.hk")).toBe("ta");
      expect(rolesByEmail.get("instructor1@ust.hk")).toBe("instructor");
      expect(rolesByEmail.get("observer1@ust.hk")).toBe("observer");
    });

    test("throws AppealPermissionError for a non-participant", async () => {
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
        await appealService
          .auth(otherStudent.email)
          .getAppealParticipants(appealID);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealPermissionError);
      }
    });
  });

  describe("closeAppeal", () => {
    async function createAppeal(): Promise<string> {
      return await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );
    }

    test("an instructor participant can request a close, which stores the result", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();

      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "Grade adjusted to 90");

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.state).toBe("open");
      expect(appeal.closeRequest?.result).toBe("Grade adjusted to 90");
      expect(appeal.closeRequest?.requestedBy).toBe("instructor1@ust.hk");
      expect(appeal.closeRequest?.requestedAt).toBeDefined();
    });

    test("throws CoursePermissionError when a student requests a close", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();

      try {
        await appealService
          .auth(student.email)
          .requestClose(appealID, "Result");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("throws AppealClosedError when requesting a close on a closed appeal", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await testConn.collections.appeals.updateOne(
        { id: appealID },
        { $set: { state: "closed" } },
      );

      try {
        await appealService
          .auth(instructor.email)
          .requestClose(appealID, "Result");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealClosedError);
      }
    });

    test("throws AppealClosePendingError when a close is already pending", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "First result");

      try {
        await appealService
          .auth(instructor.email)
          .requestClose(appealID, "Second result");
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealClosePendingError);
      }
    });

    test("the student can agree, which closes the appeal and preserves the result", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "Grade adjusted to 90");

      await appealService.auth(student.email).agreeClose(appealID);

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.state).toBe("closed");
      expect(appeal.closedAt).not.toBeNull();
      expect(appeal.closeRequest?.result).toBe("Grade adjusted to 90");
      expect(appeal.messages).toHaveLength(2);
      expect(appeal.messages[1]?.kind).toBe("system");
      expect(appeal.messages[1]?.content).toBe(
        "student1 agreed to the closing request result: Grade adjusted to 90",
      );
    });

    test("throws AppealCloseRequiresStudentError when a non-student agrees", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "Result");

      try {
        await appealService.auth(instructor.email).agreeClose(appealID);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealCloseRequiresStudentError);
      }
    });

    test("throws AppealCloseRequestNotFoundError when agreeing with no pending request", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();

      try {
        await appealService.auth(student.email).agreeClose(appealID);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealCloseRequestNotFoundError);
      }
    });

    test("the student can decline, which keeps the appeal open and clears the request", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "Grade adjusted to 90");

      await appealService.auth(student.email).declineClose(appealID);

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.state).toBe("open");
      expect(appeal.closeRequest).toBeNull();
      expect(appeal.messages).toHaveLength(2);
      expect(appeal.messages[1]?.kind).toBe("system");
      expect(appeal.messages[1]?.content).toBe(
        "student1 declined the closing request result: Grade adjusted to 90",
      );

      // The discussion can continue after declining.
      await appealService
        .auth(student.email)
        .postMessage(appealID, { content: "I disagree with the result" });
      const updated = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(updated.messages).toHaveLength(3);
    });

    test("throws AppealClosedError when posting to a closed appeal", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor],
        courses: [instructorCourse()],
      });
      const appealID = await createAppeal();
      await appealService
        .auth(instructor.email)
        .requestClose(appealID, "Result");
      await appealService.auth(student.email).agreeClose(appealID);

      try {
        await appealService
          .auth(student.email)
          .postMessage(appealID, { content: "Too late" });
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealClosedError);
      }
    });
  });

  describe("inviteParticipant", () => {
    async function createAppealAsStudent(): Promise<string> {
      return await appealService
        .auth(student.email)
        .createAppeal(
          { course: { code: "COMP 1023", term: "2510" }, assignment: "A1" },
          { content: "I think my grade is wrong" },
        );
    }

    test("an instructor participant can invite an observer, who gains view and post access", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();

      await appealService
        .auth(instructor.email)
        .inviteParticipant(appealID, observer.email);

      const appeal = await appealService
        .auth(student.email)
        .getAppeal(appealID);
      expect(appeal.participants).toContain(observer.email);

      // The invitee can now view and post.
      await appealService
        .auth(observer.email)
        .postMessage(appealID, { content: "I'll look into it." });
      const updated = await appealService
        .auth(observer.email)
        .getAppeal(appealID);
      expect(updated.messages[updated.messages.length - 1]?.content).toBe(
        "I'll look into it.",
      );
    });

    test("throws AppealPermissionError when a non-participant invites", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer, otherStudent],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();

      try {
        await appealService
          .auth(otherStudent.email)
          .inviteParticipant(appealID, observer.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealPermissionError);
      }
    });

    test("throws CoursePermissionError when a student participant invites", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();

      try {
        await appealService
          .auth(student.email)
          .inviteParticipant(appealID, observer.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("throws CoursePermissionError when the invitee is not an instructor or observer", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer, otherStudent],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();

      try {
        await appealService
          .auth(instructor.email)
          .inviteParticipant(appealID, otherStudent.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(CoursePermissionError);
      }
    });

    test("throws AppealParticipantExistsError when the invitee is already a participant", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();

      try {
        await appealService
          .auth(instructor.email)
          .inviteParticipant(appealID, ta.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealParticipantExistsError);
      }
    });

    test("throws AppealClosedError when the appeal is closed", async () => {
      await insertData(testConn, {
        users: [student, ta, instructor, observer],
        courses: [instructorCourse()],
      });
      const appealID = await createAppealAsStudent();
      await testConn.collections.appeals.updateOne(
        { id: appealID },
        { $set: { state: "closed" } },
      );

      try {
        await appealService
          .auth(instructor.email)
          .inviteParticipant(appealID, observer.email);
        expect.unreachable("should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(AppealClosedError);
      }
    });
  });
});
