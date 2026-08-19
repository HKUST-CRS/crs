import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import type { CommentInit, Course, RequestInit, User } from "../models";
import { createRepos } from "../repos";
import { RequestService } from "../services";
import {
  AssignmentNotFoundError,
  AssignmentNotGradedError,
  PermissionError,
  RequestParticipantError,
} from "../services/error";
import { clearData, insertData } from "./tests";

const appealCourse: Course = {
  code: "COMP 9999",
  term: "2510",
  title: "Appeal Testing",
  sections: {
    L1: { schedule: [] },
    L2: { schedule: [] },
  },
  assignments: {
    HW1: {
      name: "Homework 1",
      due: "2025-11-01T23:59:00+08:00",
      state: "graded",
      maxExtension: "P1D",
      tas: ["ta1@ust.hk"],
    },
    HW2: {
      name: "Homework 2",
      due: "2025-12-01T23:59:00+08:00",
      maxExtension: "P1D",
      // no `state` → not graded
    },
  },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Assignment Appeal": true,
  },
};

function makeUser(
  email: string,
  role: "student" | "instructor" | "observer" | "admin",
  section = "L1",
): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: [
      {
        role,
        course: { code: appealCourse.code, term: appealCourse.term },
        section,
      },
    ],
    sudoer: false,
  };
}

/** A TA responsible for the assignment, with no course enrollment. */
const ta: User = {
  email: "ta1@ust.hk",
  name: "ta1",
  enrollment: [],
  sudoer: false,
};

function makeAppealInit(section = "L1", assignment = "HW1"): RequestInit {
  return {
    type: "Assignment Appeal",
    class: {
      course: { code: appealCourse.code, term: appealCourse.term },
      section,
    },
    metadata: { assignment },
  };
}

function makeAppealComment(text = "I would like a re-mark."): CommentInit {
  return { text, proofs: [] };
}

describe("Assignment Appeal requests", () => {
  let testConn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let requestService: RequestService;

  const student = makeUser("s1@ust.hk", "student", "L1");
  const lecturer1 = makeUser("i1@ust.hk", "instructor", "L1");
  const lecturer2 = makeUser("i2@ust.hk", "instructor", "L2");
  const observer = makeUser("o1@ust.hk", "observer", "L1");

  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    testConn = await DbConn.create(memoryServer.getUri());
    requestService = new RequestService(createRepos(testConn.collections));
  });

  afterAll(async () => {
    await testConn.close();
    await memoryServer.stop();
  });

  beforeEach(async () => {
    await clearData(testConn);
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe("create", () => {
    test("resolves participants from the section instructors + assignment TAs", async () => {
      await insertData(testConn, {
        users: [student, lecturer1, ta],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.type).toBe("Assignment Appeal");
      expect(r.metadata).toEqual({ assignment: "HW1" });
      // the student is a participant, but not via the stored from-only list
      expect(r.participants).toEqual(
        expect.arrayContaining([student.email, lecturer1.email, ta.email]),
      );
      // opening reason is the first thread comment
      expect(r.thread).toHaveLength(1);
      expect(r.thread[0]?.kind).toBe("comment");
      if (r.thread[0]?.kind === "comment") {
        expect(r.thread[0].text).toBe("I would like a re-mark.");
      }
    });

    test("rejects an unknown assignment", async () => {
      await insertData(testConn, {
        users: [student],
        courses: [appealCourse],
      });
      try {
        await requestService
          .auth(student.email)
          .createRequest(makeAppealInit("L1", "NOPE"), makeAppealComment());
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AssignmentNotFoundError);
      }
    });

    test("rejects an assignment that is not graded", async () => {
      await insertData(testConn, {
        users: [student],
        courses: [appealCourse],
      });
      try {
        await requestService
          .auth(student.email)
          .createRequest(makeAppealInit("L1", "HW2"), makeAppealComment());
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AssignmentNotGradedError);
      }
    });
  });

  // ── access ────────────────────────────────────────────────────────────────
  describe("access", () => {
    test("the student, the section lecturer and the TA can get the appeal", async () => {
      await insertData(testConn, {
        users: [student, lecturer1, ta],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      for (const email of [student.email, lecturer1.email, ta.email]) {
        const r = await requestService.auth(email).getRequest(id);
        expect(r.id).toBe(id);
      }
    });

    test("an observer in the class is not a participant", async () => {
      await insertData(testConn, {
        users: [student, observer],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(observer.email).getRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestParticipantError);
      }
    });

    test("an instructor of another section is not a participant", async () => {
      await insertData(testConn, {
        users: [student, lecturer2],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(lecturer2.email).getRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestParticipantError);
      }
    });
  });

  // ── comment ───────────────────────────────────────────────────────────────
  describe("comment", () => {
    test("a TA and a lecturer can comment", async () => {
      await insertData(testConn, {
        users: [student, lecturer1, ta],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(ta.email).comment(id, { text: "noted" });
      await requestService
        .auth(lecturer1.email)
        .comment(id, { text: "reviewing" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.thread).toHaveLength(3);
    });

    test("a non-participant cannot comment", async () => {
      await insertData(testConn, {
        users: [student, observer],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(observer.email).comment(id, { text: "hi" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestParticipantError);
      }
    });
  });

  // ── approve / reject ──────────────────────────────────────────────────────
  describe("approve / reject", () => {
    test("a TA can approve an appeal", async () => {
      await insertData(testConn, {
        users: [student, ta],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(ta.email).approve(id);
      expect(
        (await requestService.auth(student.email).getRequest(id)).status,
      ).toBe("approved");
    });

    test("a lecturer can reject an appeal", async () => {
      await insertData(testConn, {
        users: [student, lecturer1],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(lecturer1.email).reject(id);
      expect(
        (await requestService.auth(student.email).getRequest(id)).status,
      ).toBe("rejected");
    });

    test("the student cannot decide their own appeal", async () => {
      await insertData(testConn, {
        users: [student],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(student.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });

    test("a non-participant cannot decide", async () => {
      await insertData(testConn, {
        users: [student, observer],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(observer.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestParticipantError);
      }
    });
  });

  // ── lists ─────────────────────────────────────────────────────────────────
  describe("lists", () => {
    test("the student sees their own appeal", async () => {
      await insertData(testConn, {
        users: [student],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(student.email)
        .getRequestsAs(["student"]);
      expect(requests).toHaveLength(1);
    });

    test("a section lecturer sees the appeal they participate in", async () => {
      await insertData(testConn, {
        users: [student, lecturer1],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(lecturer1.email)
        .getRequestsAs(["instructor"]);
      expect(requests).toHaveLength(1);
    });

    test("an instructor of another section does not see the appeal", async () => {
      await insertData(testConn, {
        users: [student, lecturer1, lecturer2],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(lecturer2.email)
        .getRequestsAs(["instructor"]);
      expect(requests).toHaveLength(0);
    });

    test("an observer in the class does not see the appeal", async () => {
      await insertData(testConn, {
        users: [student, observer],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(observer.email)
        .getRequestsAs(["instructor", "observer"]);
      expect(requests).toHaveLength(0);
    });

    test("a TA without an instructor enrollment still sees the appeal", async () => {
      await insertData(testConn, {
        users: [student, ta],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(ta.email)
        .getRequestsAs(["instructor", "observer"]);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.id).toBeTruthy();
    });
  });

  // ── cancel / appeal ───────────────────────────────────────────────────────
  describe("cancel / appeal", () => {
    test("the student can cancel their own appeal", async () => {
      await insertData(testConn, {
        users: [student],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(student.email).cancel(id);
      expect(
        (await requestService.auth(student.email).getRequest(id)).status,
      ).toBe("cancelled");
    });

    test("a decided appeal cannot be re-appealed", async () => {
      await insertData(testConn, {
        users: [student, lecturer1],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(lecturer1.email).reject(id);
      try {
        await requestService
          .auth(student.email)
          .appeal(id, { text: "please reconsider" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });
  });

  // ── admin access ─────────────────────────────────────────────────────────
  describe("admin access", () => {
    const admin = makeUser("admin1@ust.hk", "admin", "L1");
    const otherCourseAdmin: User = {
      email: "admin2@ust.hk",
      name: "admin2",
      enrollment: [
        {
          role: "admin",
          course: { code: "OTHER 0000", term: "2510" },
          section: "*",
        },
      ],
      sudoer: false,
    };

    test("an admin of the course can get an appeal they are not a participant of", async () => {
      await insertData(testConn, {
        users: [student, admin],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const r = await requestService.auth(admin.email).getRequest(id);
      expect(r.id).toBe(id);
    });

    test("an admin of the course can comment and decide on an appeal", async () => {
      await insertData(testConn, {
        users: [student, admin],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      await requestService.auth(admin.email).comment(id, { text: "reviewing" });
      await requestService.auth(admin.email).approve(id);
      expect(
        (await requestService.auth(student.email).getRequest(id)).status,
      ).toBe("approved");
    });

    test("an admin who filed the appeal can decide it", async () => {
      const adminStudent: User = {
        email: "adminstudent@ust.hk",
        name: "adminstudent",
        enrollment: [
          {
            role: "admin",
            course: { code: appealCourse.code, term: appealCourse.term },
            section: "L1",
          },
          {
            role: "student",
            course: { code: appealCourse.code, term: appealCourse.term },
            section: "L1",
          },
        ],
        sudoer: false,
      };
      await insertData(testConn, {
        users: [adminStudent],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(adminStudent.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      // The requester is also an admin, so they may decide their own appeal.
      await requestService.auth(adminStudent.email).approve(id);
      expect(
        (await requestService.auth(adminStudent.email).getRequest(id)).status,
      ).toBe("approved");
    });

    test("an admin sees every appeal in their course in the instructor listing", async () => {
      await insertData(testConn, {
        users: [student, admin],
        courses: [appealCourse],
      });
      await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      const requests = await requestService
        .auth(admin.email)
        .getRequestsAs(["instructor", "observer"]);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.id).toBeTruthy();
    });

    test("an admin sees appeals from sections they are not enrolled in", async () => {
      // The admin is enrolled in L1; the appeal is raised in L2. Admin
      // visibility is course-wide, so the enrollment's section must not limit
      // the listing.
      const studentInL2 = makeUser("s2@ust.hk", "student", "L2");
      await insertData(testConn, {
        users: [studentInL2, admin],
        courses: [appealCourse],
      });
      await requestService
        .auth(studentInL2.email)
        .createRequest(makeAppealInit("L2"), makeAppealComment());
      const requests = await requestService
        .auth(admin.email)
        .getRequestsAs(["instructor", "observer"]);
      expect(requests).toHaveLength(1);
    });

    test("an admin of another course cannot see the appeal", async () => {
      await insertData(testConn, {
        users: [student, otherCourseAdmin],
        courses: [appealCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeAppealInit(), makeAppealComment());
      try {
        await requestService.auth(otherCourseAdmin.email).getRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestParticipantError);
      }
      const requests = await requestService
        .auth(otherCourseAdmin.email)
        .getRequestsAs(["instructor", "observer"]);
      expect(requests).toHaveLength(0);
    });
  });
});
