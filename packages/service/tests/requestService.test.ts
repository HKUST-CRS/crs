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
import type { Course, Proof, Request, RequestInit, User } from "../models";
import { decisionRemark } from "../models";
import { createRepos } from "../repos";
import { RequestNotFoundError, StatusConflictError } from "../repos/error";
import { RequestService } from "../services";
import { ClassPermissionError, PermissionError } from "../services/error";
import { clearData, insertData } from "./tests";

const baseCourse: Course = {
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

function makeUser(
  email: string,
  role: "student" | "instructor" | "observer",
  section = "L1",
): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: [
      {
        role,
        course: { code: baseCourse.code, term: baseCourse.term },
        section,
      },
    ],
    sudoer: false,
  };
}

function makeAdmin(email: string): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: [
      {
        role: "admin",
        course: { code: baseCourse.code, term: baseCourse.term },
        section: "L1",
      },
    ],
    sudoer: false,
  };
}

function makeSwapInit(section = "L1", proof: Proof = []): RequestInit {
  return {
    type: "Swap Section",
    class: {
      course: { code: baseCourse.code, term: baseCourse.term },
      section,
    },
    details: { reason: "I need to swap.", proof },
    metadata: {
      fromSection: "L1",
      fromDate: "2025-11-25",
      toSection: "L2",
      toDate: "2025-11-26",
    },
  };
}

const sampleProof = [
  {
    name: "note.txt",
    size: 2,
    content: Buffer.from("hi").toString("base64"),
  },
];

// A bare legacy body (pre-thread: no status/updates, reason+proof in details).
function legacyBody(id: string, from: string, response: unknown) {
  return {
    id,
    from,
    class: {
      course: { code: baseCourse.code, term: baseCourse.term },
      section: "L1",
    },
    type: "Swap Section",
    metadata: {
      fromSection: "L1",
      fromDate: "2025-11-25",
      toSection: "L2",
      toDate: "2025-11-26",
    },
    details: { reason: "legacy reason", proof: [] },
    timestamp: "2025-01-01T00:00:00+08:00",
    response,
  } as unknown as Request;
}

describe("RequestService", () => {
  let testConn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let requestService: RequestService;

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

  afterEach(() => {
    // keep the linter quiet about async setup
  });

  // ── createRequest ────────────────────────────────────────────────────────
  describe("createRequest", () => {
    test("creates a request and seeds the opening reason as the first comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.from).toBe(student.email);
      expect(r.status).toBe("open");
      expect(r.updates).toHaveLength(1);
      expect(r.updates[0]?.kind).toBe("comment");
      if (r.updates[0]?.kind === "comment") {
        expect(r.updates[0].text).toBe("I need to swap.");
      }
    });

    test("stores the opening proof on the first comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit("L1", sampleProof));
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.updates[0]?.kind).toBe("comment");
      if (r.updates[0]?.kind === "comment") {
        expect(r.updates[0].proof).toEqual(sampleProof);
      }
    });

    test("throws a permission error when the user is not in the class", async () => {
      const student = makeUser("s1@connect.ust.hk", "student", "L1");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      try {
        await requestService
          .auth(student.email)
          .createRequest(makeSwapInit("L2"));
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("throws a permission error when an instructor tries to create", async () => {
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [instructor],
        courses: [baseCourse],
      });
      try {
        await requestService
          .auth(instructor.email)
          .createRequest(makeSwapInit());
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });
  });

  // ── getRequest ───────────────────────────────────────────────────────────
  describe("getRequest", () => {
    test("requester can get their own request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.id).toBe(id);
    });

    test("observers can get requests in their class", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const observer = makeUser("o1@ust.hk", "observer");
      await insertData(testConn, {
        users: [student, observer],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const r = await requestService.auth(observer.email).getRequest(id);
      expect(r.id).toBe(id);
    });

    test("instructors can get requests in their class", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.id).toBe(id);
    });

    test("a non-participant cannot get the request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student", "L1");
      const other = makeUser("s2@connect.ust.hk", "student", "L2");
      await insertData(testConn, {
        users: [student, other],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(other.email).getRequest(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("throws request-not-found when the request does not exist", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      try {
        await requestService.auth(student.email).getRequest("nope");
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RequestNotFoundError);
      }
    });
  });

  // ── request list projections ─────────────────────────────────────────────
  describe("request list projections", () => {
    test("heads omit metadata and updates", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await requestService.auth(student.email).createRequest(makeSwapInit());
      const heads = await requestService
        .auth(student.email)
        .getRequestHeadsAs(["student"]);
      expect(heads).toHaveLength(1);
      expect(heads[0]).not.toHaveProperty("updates");
      expect(heads[0]).not.toHaveProperty("metadata");
      expect(heads[0]?.status).toBe("open");
    });

    test("instructors see heads for their class, including section '*'", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor: User = {
        ...makeUser("i1@ust.hk", "instructor"),
        enrollment: [
          {
            role: "instructor",
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "*",
          },
        ],
      };
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      await requestService.auth(student.email).createRequest(makeSwapInit());
      const heads = await requestService
        .auth(instructor.email)
        .getRequestHeadsAs(["instructor"]);
      expect(heads).toHaveLength(1);
    });

    test("getRequestsByID preserves the input order and ignores missing ids", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const a = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const b = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const got = await requestService
        .auth(student.email)
        .getRequestsByID([b, "missing", a]);
      expect(got.map((r) => r.id)).toEqual([b, a]);
    });
  });

  // ── addComment ───────────────────────────────────────────────────────────
  describe("addComment", () => {
    test("a student can comment on an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).addComment(id, { text: "more" });
      const r = await requestService.auth(student.email).getRequest(id);
      // opening comment + the new comment
      expect(r.updates).toHaveLength(2);
      expect(r.updates.at(-1)?.kind).toBe("comment");
      expect(r.status).toBe("open");
    });

    test("an instructor and an observer can comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      const observer = makeUser("o1@ust.hk", "observer");
      await insertData(testConn, {
        users: [student, instructor, observer],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(instructor.email)
        .addComment(id, { text: "noted" });
      await requestService
        .auth(observer.email)
        .addComment(id, { text: "observing" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.updates).toHaveLength(3);
    });

    test("a comment is allowed on a cancelled request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancel(id);
      await requestService.auth(student.email).addComment(id, { text: "bye" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("cancelled");
      expect(r.updates.at(-1)?.kind).toBe("comment");
    });

    test("a non-participant cannot comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student", "L1");
      const other = makeUser("s2@connect.ust.hk", "student", "L2");
      await insertData(testConn, {
        users: [student, other],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(other.email).addComment(id, { text: "hi" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("comment proof round-trips through getRequest", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).addComment(id, {
        text: "see attached",
        proof: sampleProof,
      });
      const r = await requestService.auth(student.email).getRequest(id);
      const entry = r.updates.at(-1);
      expect(entry?.kind).toBe("comment");
      if (entry?.kind === "comment") expect(entry.proof).toEqual(sampleProof);
    });
  });

  // ── approve / reject ─────────────────────────────────────────────────────
  describe("approve / reject", () => {
    test("an instructor can approve an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).approve(id);
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.status).toBe("approved");
      expect(r.updates.at(-1)?.kind).toBe("status");
    });

    test("a student cannot approve", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(student.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("an observer cannot approve", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const observer = makeUser("o1@ust.hk", "observer");
      await insertData(testConn, {
        users: [student, observer],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(observer.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("an admin cannot approve", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const admin = makeAdmin("admin1@ust.hk");
      await insertData(testConn, {
        users: [student, admin],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(admin.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
    });

    test("approving on a cancelled request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancel(id);
      try {
        await requestService.auth(instructor.email).approve(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });

    test("a remark is recorded as a comment followed by the status change", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(instructor.email)
        .reject(id, { text: "insufficient evidence", proof: sampleProof });
      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.status).toBe("rejected");
      const tail = r.updates.slice(-2);
      expect(tail[0]?.kind).toBe("comment");
      expect(tail[1]?.kind).toBe("status");
      if (tail[0]?.kind === "comment") {
        expect(tail[0].text).toBe("insufficient evidence");
        expect(tail[0].proof).toEqual(sampleProof);
      }
      if (tail[1]?.kind === "status") expect(tail[1].status).toBe("rejected");
    });

    test("an instructor can change their decision (approve then reject)", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).approve(id);
      expect(
        (await requestService.auth(instructor.email).getRequest(id)).status,
      ).toBe("approved");
      // re-decision is allowed: the instructor flips to reject
      await requestService.auth(instructor.email).reject(id);
      expect(
        (await requestService.auth(instructor.email).getRequest(id)).status,
      ).toBe("rejected");
    });

    test("decisionRemark returns the decider's remark and ignores unrelated comments", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService
        .auth(instructor.email)
        .approve(id, { text: "looks good" });
      // A follow-up comment by the requester must not become the remark.
      await requestService
        .auth(student.email)
        .addComment(id, { text: "thanks" });
      let r = await requestService.auth(student.email).getRequest(id);
      expect(decisionRemark(r)).toBe("looks good");

      // A decision without a remark yields "" — never the requester's reason,
      // which is the comment that immediately precedes the status change.
      const id2 = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).approve(id2);
      r = await requestService.auth(student.email).getRequest(id2);
      expect(decisionRemark(r)).toBe("");
    });
  });

  // ── cancel ───────────────────────────────────────────────────────────────
  describe("cancel", () => {
    test("the requester can cancel an open request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancel(id);
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("cancelled");
      expect(r.updates.at(-1)?.kind).toBe("status");
    });

    test("an instructor cannot cancel", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(instructor.email).cancel(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });

    test("the requester can cancel an already-decided request", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).approve(id);
      await requestService.auth(student.email).cancel(id);
      expect(
        (await requestService.auth(student.email).getRequest(id)).status,
      ).toBe("cancelled");
    });

    test("cancelling a cancelled request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(student.email).cancel(id);
      try {
        await requestService.auth(student.email).cancel(id);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });
  });

  // ── appeal ───────────────────────────────────────────────────────────────
  describe("appeal", () => {
    test("the requester can appeal a rejected request, flagging it for review", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).reject(id);
      await requestService
        .auth(student.email)
        .appeal(id, { text: "please reconsider" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.status).toBe("appealed");
      const tail = r.updates.slice(-2);
      expect(tail[0]?.kind).toBe("comment");
      expect(tail[1]?.kind).toBe("status");
    });

    test("an instructor cannot appeal", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).reject(id);
      try {
        await requestService.auth(instructor.email).appeal(id, { text: "no" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
      }
    });

    test("appealing an open request throws", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      try {
        await requestService.auth(student.email).appeal(id, { text: "no" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(StatusConflictError);
      }
    });

    test("appeal proof round-trips through getRequest", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      await requestService.auth(instructor.email).reject(id);
      await requestService.auth(student.email).appeal(id, {
        text: "reconsider",
        proof: sampleProof,
      });
      const r = await requestService.auth(student.email).getRequest(id);
      const comment = r.updates.at(-2);
      expect(comment?.kind).toBe("comment");
      if (comment?.kind === "comment")
        expect(comment.proof).toEqual(sampleProof);
    });
  });

  // ── appeal cycle ─────────────────────────────────────────────────────────
  describe("appeal cycle", () => {
    test("reject → appeal → approve updates the status and thread", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());

      await requestService.auth(instructor.email).reject(id);
      await requestService
        .auth(student.email)
        .appeal(id, { text: "reconsider" });
      await requestService.auth(instructor.email).approve(id);

      const r = await requestService.auth(instructor.email).getRequest(id);
      expect(r.status).toBe("approved");
      // opening comment, status(rejected), comment(appeal), status(appealed),
      // status(approved)
      const kinds = r.updates.map((u) => u.kind);
      expect(kinds).toEqual([
        "comment",
        "status",
        "comment",
        "status",
        "status",
      ]);
    });
  });

  // ── immutability ─────────────────────────────────────────────────────────
  describe("immutability", () => {
    test("thread actions never mutate the request body", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit());
      const original = await requestService.auth(student.email).getRequest(id);

      await requestService.auth(student.email).addComment(id, { text: "c" });
      await requestService.auth(instructor.email).approve(id);
      await requestService.auth(student.email).appeal(id, { text: "a" });
      await requestService.auth(instructor.email).reject(id);
      await requestService.auth(student.email).cancel(id);

      const after = await requestService.auth(student.email).getRequest(id);
      expect(after.from).toBe(original.from);
      expect(after.class).toEqual(original.class);
      expect(after.type).toBe(original.type);
      expect(after.metadata).toEqual(original.metadata);
      expect(after.timestamp).toBe(original.timestamp);
    });
  });

  // ── legacy document tolerance ────────────────────────────────────────────
  describe("legacy document tolerance", () => {
    test("a pre-thread open doc is normalized and keeps its reason as the opening comment", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [legacyBody("l-open", student.email, null)],
      });
      const r = await requestService.auth(student.email).getRequest("l-open");
      expect(r.status).toBe("open");
      expect(r.updates).toHaveLength(1);
      expect(r.updates[0]?.kind).toBe("comment");
      if (r.updates[0]?.kind === "comment") {
        expect(r.updates[0].text).toBe("legacy reason");
      }
    });

    test("a pre-thread doc with an Approve response is inferred as approved", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [
          legacyBody("l-approved", student.email, {
            from: "i1@ust.hk",
            timestamp: "2025-01-02T00:00:00+08:00",
            remarks: "ok",
            decision: "Approve",
          }),
        ],
      });
      const r = await requestService
        .auth(student.email)
        .getRequest("l-approved");
      expect(r.status).toBe("approved");
    });

    test("a pre-thread decided doc preserves the decider, timestamp, and remark", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [
          legacyBody("l-decided", student.email, {
            from: "i1@ust.hk",
            timestamp: "2025-01-02T00:00:00+08:00",
            remarks: "granted",
            decision: "Approve",
          }),
        ],
      });
      const r = await requestService
        .auth(student.email)
        .getRequest("l-decided");
      expect(r.status).toBe("approved");
      expect(r.updates.at(-1)?.kind).toBe("status");
      const decision = r.updates.at(-1);
      if (decision && decision.kind === "status") {
        expect(decision.status).toBe("approved");
        expect(decision.from).toBe("i1@ust.hk");
        expect(decision.timestamp).toBe("2025-01-02T00:00:00+08:00");
      }
      expect(decisionRemark(r)).toBe("granted");
    });

    test("legacy request heads are normalized", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [legacyBody("l-head", student.email, null)],
      });
      const heads = await requestService
        .auth(student.email)
        .getRequestHeadsAs(["student"]);
      expect(heads).toHaveLength(1);
      expect(heads[0]?.status).toBe("open");
      expect(heads[0]).not.toHaveProperty("updates");
    });

    test("an un-backfilled open request can be approved", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      const instructor = makeUser("i1@ust.hk", "instructor");
      await insertData(testConn, {
        users: [student, instructor],
        courses: [baseCourse],
      });
      await insertData(testConn, {
        requests: [legacyBody("l-approve", student.email, null)],
      });
      await requestService.auth(instructor.email).approve("l-approve");
      const r = await requestService
        .auth(instructor.email)
        .getRequest("l-approve");
      expect(r.status).toBe("approved");
      expect(r.updates.at(-1)?.kind).toBe("status");
    });

    test("an un-backfilled rejected request can be appealed", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      await insertData(testConn, {
        requests: [
          legacyBody("l-appeal", student.email, {
            from: "i1@ust.hk",
            timestamp: "2025-01-02T00:00:00+08:00",
            remarks: "no",
            decision: "Reject",
          }),
        ],
      });
      await requestService
        .auth(student.email)
        .appeal("l-appeal", { text: "reconsider" });
      const r = await requestService.auth(student.email).getRequest("l-appeal");
      expect(r.status).toBe("appealed");
    });

    test("a feat/threads-era doc with response/cancel/appeal entries is converted", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      // A document written by the previous thread model: status "resolved",
      // details on the body, and a response entry in updates.
      const legacy: Request[] = [
        {
          id: "l-feat",
          from: student.email,
          class: {
            course: { code: baseCourse.code, term: baseCourse.term },
            section: "L1",
          },
          type: "Swap Section",
          metadata: {
            fromSection: "L1",
            fromDate: "2025-11-25",
            toSection: "L2",
            toDate: "2025-11-26",
          },
          details: { reason: "old reason", proof: [] },
          timestamp: "2025-01-01T00:00:00+08:00",
          status: "resolved",
          response: {
            from: "i1@ust.hk",
            timestamp: "2025-01-02T00:00:00+08:00",
            remarks: "ok",
            decision: "Approve",
          },
          updates: [
            {
              id: "old-response",
              from: "i1@ust.hk",
              timestamp: "2025-01-02T00:00:00+08:00",
              kind: "response",
              remarks: "ok",
              decision: "Approve",
            },
          ],
        } as unknown as Request,
      ];
      await insertData(testConn, { requests: legacy });
      const r = await requestService.auth(student.email).getRequest("l-feat");
      expect(r.status).toBe("approved");
      // opening comment (from details) + the converted status entry
      expect(r.updates[0]?.kind).toBe("comment");
      if (r.updates[0]?.kind === "comment") {
        expect(r.updates[0].text).toBe("old reason");
      }
      expect(r.updates.at(-1)?.kind).toBe("status");
    });
  });
});
