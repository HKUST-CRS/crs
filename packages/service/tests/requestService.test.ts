import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import type {
  Course,
  ProofFile,
  ProofFileUpload,
  ProofUpload,
  RequestInit,
  User,
} from "../models";
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

function makeSwapInit(section = "L1", proof: ProofUpload = []): RequestInit {
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

const sampleProof: ProofUpload = [
  {
    name: "note.txt",
    size: 2,
    content: Buffer.from("hi").toString("base64"),
  },
];

// Stored proof entries use stable attachment IDs, so compare against the
// uploaded payload by name/size and verify the bytes round-trip via readProof.
async function expectStoredProof(
  proof: ProofFile[] | undefined,
  uploads: ProofFileUpload[],
  svc: RequestService<string>,
) {
  expect(proof).toHaveLength(uploads.length);
  for (const [i, f] of (proof ?? []).entries()) {
    const expected = uploads[i];
    if (!expected) continue;
    expect(f.name).toBe(expected.name);
    expect(f.size).toBe(expected.size);
    expect(f.hash).toBe(
      crypto
        .createHash("sha256")
        .update(Buffer.from(expected.content, "base64"))
        .digest("hex"),
    );
    expect(typeof f.attachmentId).toBe("string");
    const { content } = await svc.readProof(f.attachmentId);
    expect(content).toBe(expected.content);
  }
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
        await expectStoredProof(
          r.updates[0].proof,
          sampleProof,
          requestService.auth(student.email),
        );
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

    test("an instructor can comment", async () => {
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
        .addComment(id, { text: "noted" });
      const r = await requestService.auth(student.email).getRequest(id);
      expect(r.updates).toHaveLength(2);
    });

    test("an observer cannot comment", async () => {
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
        await requestService
          .auth(observer.email)
          .addComment(id, { text: "observing" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClassPermissionError);
      }
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
      if (entry?.kind === "comment")
        await expectStoredProof(
          entry.proof,
          sampleProof,
          requestService.auth(student.email),
        );
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

    test("action text is recorded as a comment followed by the status change", async () => {
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
        await expectStoredProof(
          tail[0].proof,
          sampleProof,
          requestService.auth(instructor.email),
        );
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
        await expectStoredProof(
          comment.proof,
          sampleProof,
          requestService.auth(student.email),
        );
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

  // ── proof storage ─────────────────────────────────────────────────────────
  describe("proof storage", () => {
    test("persists the decoded byte length and content hash, ignoring client claims", async () => {
      const student = makeUser("s1@connect.ust.hk", "student");
      await insertData(testConn, { users: [student], courses: [baseCourse] });
      const lying: ProofUpload = [
        {
          name: "note.txt",
          size: 1,
          content: Buffer.from("hi").toString("base64"),
        },
      ];
      const id = await requestService
        .auth(student.email)
        .createRequest(makeSwapInit("L1", lying));
      const r = await requestService.auth(student.email).getRequest(id);
      const opening = r.updates[0];
      if (opening?.kind === "comment" && opening.proof?.[0]) {
        expect(opening.proof[0].size).toBe(2);
        expect(opening.proof[0].hash).toBe(
          crypto.createHash("sha256").update("hi").digest("hex"),
        );
      }
    });
  });
});
