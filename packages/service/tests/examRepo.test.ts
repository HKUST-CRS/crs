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
import {
  Course,
  Exam,
  ExamAppealMeta,
  RequestInit,
  RequestSerialization,
} from "../models";
import { RequestRepo } from "../repos/RepoRequest";
import { clearData } from "./tests";

const student = "student@connect.ust.hk";
const courseID = { code: "COMP 1023", term: "2510" };
const clazz = { course: courseID, section: "L1" };
const request: RequestInit = {
  type: "Exam Appeal",
  class: clazz,
  metadata: { examCode: "midterm", question: "1" },
};
const proof = {
  name: "script.txt",
  size: 2,
  content: Buffer.from("hi").toString("base64"),
};

describe("exam appeal schemas", () => {
  test("legacy courses default to no exams and disabled appeals", () => {
    const course = Course.parse({
      ...courseID,
      title: "Python",
      sections: {},
      assignments: {},
      effectiveRequestTypes: {
        "Swap Section": true,
        "Absent from Section": true,
        "Deadline Extension": true,
      },
    });
    expect(course.exams).toEqual({});
    expect(course.effectiveRequestTypes["Exam Appeal"]).toBe(false);
    expect(course.effectiveRequestTypes["Exam Special Arrangement"]).toBe(
      false,
    );
  });

  test("question keys are nonempty and each value contains one grader email", () => {
    expect(Exam.parse({ questions: { " 1 ": { grader: student } } })).toEqual({
      questions: { "1": { grader: student } },
    });
    for (const questions of [
      { " ": { grader: student } },
      { "1": { grader: "not-an-email" } },
      { "1": { grader: [student, "other@connect.ust.hk"] } },
      { "1": { grader: student, question: "1" } },
      { "1": {} },
    ])
      expect(Exam.safeParse({ questions }).success).toBe(false);
  });

  test("stored metadata contains exactly one exam/question pair", () => {
    expect(ExamAppealMeta.safeParse(request.metadata).success).toBe(true);
    for (const metadata of [
      { examCode: "midterm", questions: ["1", "2"] },
      { examCode: "midterm", question: ["1", "2"] },
      { examCode: "midterm", question: " " },
      { examCode: "midterm", question: "1", grader: student },
      { examCode: "midterm", question: "1", reason: "Old ticket reason" },
    ])
      expect(RequestInit.safeParse({ ...request, metadata }).success).toBe(
        false,
      );
  });
});

describe("exam request storage", () => {
  let server: MongoMemoryReplSet;
  let conn: DbConn;
  let repo: RequestRepo;
  beforeAll(async () => {
    server = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    conn = await DbConn.create(server.getUri());
    repo = new RequestRepo(conn.collections);
  }, 120_000);
  afterAll(async () => {
    await conn?.close();
    await server?.stop();
  });
  beforeEach(async () => {
    await clearData(conn);
  });

  test("ordinary storage keeps the opening reason/proof in the thread and serializes exam fields", async () => {
    const text = "Please review question 1.";
    const id = await repo.createRequest(student, request, {
      text,
      proofs: [proof],
    });
    const stored = await repo.requireRequest(id);
    expect(stored.type).toBe("Exam Appeal");
    expect(stored.metadata).toEqual(request.metadata);
    expect(stored.status).toBe("open");
    expect(stored.thread).toHaveLength(1);
    const opening = stored.thread[0];
    if (opening?.kind !== "comment") throw new Error("Missing opening comment");
    expect(opening.text).toBe(text);
    const storedProof = opening.proofs?.[0];
    expect(storedProof?.size).toBe(2);
    expect(await repo.fetchProof(storedProof?.id ?? "")).toBe(proof.content);
    expect(await conn.collections.requests.findOne({ id })).not.toHaveProperty(
      "status",
    );
    const csv = RequestSerialization.toCSV([stored], "https://crs.test");
    expect(csv).toContain("Exam,Question");
    expect(csv).toContain("midterm,1");
  });
});
