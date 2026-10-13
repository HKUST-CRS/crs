import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { MongoClient, MongoServerError } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import {
  Course,
  Exam,
  ExamAppealMeta,
  RequestBatch,
  RequestInit,
  RequestSerialization,
} from "../models";
import { RequestSubmissionConflictError } from "../repos/error";
import { RequestRepo } from "../repos/RepoRequest";
import { clearData } from "./tests";

const student = "student@connect.ust.hk";
const courseID = { code: "COMP 1023", term: "2510" };
const clazz = { course: courseID, section: "L1" };
const proof = {
  name: "script.txt",
  size: 2,
  content: Buffer.from("hi").toString("base64"),
};
function makeBatch(): RequestBatch {
  return {
    submissionId: crypto.randomUUID(),
    requests: ["1", "2"].map((question) => ({
      request: {
        type: "Exam Appeal",
        class: clazz,
        metadata: { examCode: "midterm", question },
      },
      comment: {
        text: `Please review question ${question}.`,
        proofs: [proof],
      },
    })),
  };
}

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
  });

  test("question identifiers are nonempty and unique, and grader addresses are emails", () => {
    for (const questions of [
      [{ question: " ", grader: student }],
      [{ question: "1", grader: "not-an-email" }],
      [
        { question: "1", grader: student },
        { question: "1", grader: "other@connect.ust.hk" },
      ],
    ]) {
      expect(Exam.safeParse({ questions }).success).toBe(false);
    }
  });

  test("stored metadata contains exactly one exam/question pair", () => {
    expect(
      ExamAppealMeta.safeParse({
        examCode: "midterm",
        question: "1",
      }).success,
    ).toBe(true);
    expect(
      ExamAppealMeta.safeParse({ requests: makeBatch().requests }).success,
    ).toBe(false);
    expect(
      RequestInit.safeParse({
        type: "Exam Appeal",
        class: clazz,
        metadata: {
          examCode: "midterm",
          question: "1",
          reason: "old reason",
        },
      }).success,
    ).toBe(false);
  });

  test("batch cardinality, duplicate questions, empty reasons and unexpected fields are rejected", () => {
    const batch = makeBatch();
    const first = batch.requests[0];
    if (!first) throw new Error("Missing request");
    for (const invalid of [
      { ...batch, requests: [] },
      {
        ...batch,
        requests: Array.from({ length: 51 }, (_, index) => ({
          ...first,
          request: {
            ...first.request,
            metadata: { examCode: "midterm", question: String(index) },
          },
        })),
      },
      { ...batch, requests: [first, first] },
      { ...batch, requests: [{ ...first, comment: { text: "  " } }] },
      { ...batch, requests: [{ ...first, grader: student }] },
      { ...batch, type: "Exam Appeal" },
    ]) {
      expect(RequestBatch.safeParse(invalid).success).toBe(false);
    }
  });

  test("the same question in different classes is not a duplicate target", () => {
    const batch = makeBatch();
    const first = batch.requests[0];
    if (!first) throw new Error("Missing request");
    batch.requests = [
      first,
      {
        ...first,
        request: {
          ...first.request,
          class: { ...first.request.class, section: "L2" },
        },
      },
    ];
    expect(RequestBatch.safeParse(batch).success).toBe(true);
  });
});

describe("request submission storage", () => {
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

  test("creates independent question threads and serializes exam fields", async () => {
    const batch = makeBatch();
    const result = await repo.createRequests(student, batch);
    expect(result.created).toBe(true);
    expect(result.ids).toHaveLength(2);
    expect(await conn.collections.requestSubmissions.countDocuments()).toBe(1);
    for (const [index, id] of result.ids.entries()) {
      const request = await repo.requireRequest(id);
      expect(request.type).toBe("Exam Appeal");
      expect(request.metadata).toEqual({
        examCode: "midterm",
        question: String(index + 1),
      });
      expect(request.status).toBe("open");
      expect(request.thread).toHaveLength(1);
      const opening = request.thread[0];
      expect(opening?.kind).toBe("comment");
      if (opening?.kind !== "comment")
        throw new Error("Missing opening comment");
      expect(opening.text).toBe(batch.requests[index]?.comment.text ?? "");
      const storedProof = opening.proofs?.[0];
      expect(storedProof?.size).toBe(2);
      expect(await repo.fetchProof(storedProof?.id ?? "")).toBe(proof.content);
      expect(
        await conn.collections.requests.findOne({ id }),
      ).not.toHaveProperty("status");
      const csv = RequestSerialization.toCSV([request], "https://crs.test");
      expect(csv).toContain("Exam,Question");
      expect(csv).toContain(`midterm,${index + 1}`);
    }
  });

  test("replaying a submission returns the same IDs without reuploading proofs", async () => {
    const batch = makeBatch();
    const first = await repo.createRequests(student, batch);
    const replay = await repo.createRequests(student, batch);
    expect(replay).toEqual({ ids: first.ids, created: false });
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
    const changed = structuredClone(batch);
    const appeal = changed.requests[0];
    if (!appeal) throw new Error("Missing appeal");
    appeal.comment.text = "A different reason";
    const conflict = await repo
      .createRequests(student, changed)
      .catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(RequestSubmissionConflictError);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
  });

  test("retry compares actual proof bytes rather than client-supplied sizes", async () => {
    const batch = makeBatch();
    const first = await repo.createRequests(student, batch);
    const equivalent = structuredClone(batch);
    const file = equivalent.requests[0]?.comment.proofs?.[0];
    if (!file) throw new Error("Missing proof");
    file.size = 999;
    expect(await repo.createRequests(student, equivalent)).toEqual({
      ids: first.ids,
      created: false,
    });
    file.content = Buffer.from("different proof").toString("base64");
    const conflict = await repo
      .createRequests(student, equivalent)
      .catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(RequestSubmissionConflictError);
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
  });

  test("a single ordinary request has the same normalized replay contract, scoped to its requester", async () => {
    const batch: RequestBatch = {
      submissionId: crypto.randomUUID(),
      requests: [
        {
          request: {
            type: "Absent from Section",
            class: clazz,
            metadata: { fromSection: "L1", fromDate: "2026-10-13" },
          },
          comment: { text: "  A medical appointment.  " },
        },
      ],
    };
    const first = await repo.createRequests(student, batch);
    expect(first.ids).toHaveLength(1);
    const request = await repo.requireRequest(first.ids[0] ?? "");
    expect(request.thread[0]).toMatchObject({
      kind: "comment",
      text: "A medical appointment.",
    });
    const normalized = RequestBatch.parse(batch);
    expect(await repo.createRequests(student, normalized)).toEqual({
      ids: first.ids,
      created: false,
    });
    const other = await repo.createRequests("other@connect.ust.hk", normalized);
    expect(other.created).toBe(true);
    expect(other.ids).not.toEqual(first.ids);
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.requestSubmissions.countDocuments()).toBe(2);
  });

  test("concurrent retries create exactly one batch", async () => {
    const batch = makeBatch();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => repo.createRequests(student, batch)),
    );
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(
      new Set(results.map((result) => JSON.stringify(result.ids))).size,
    ).toBe(1);
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.requestSubmissions.countDocuments()).toBe(1);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
  });

  test("a write failure rolls back every question and permits retry with the same key", async () => {
    const batch = makeBatch();
    const collection = conn.collections.requests;
    const client = await new MongoClient(server.getUri()).connect();
    const db = client.db();
    await db.command({
      collMod: collection.collectionName,
      validator: { "metadata.question": { $ne: "2" } },
    });
    try {
      const failure = await repo
        .createRequests(student, batch)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(MongoServerError);
      expect(await collection.countDocuments()).toBe(0);
      expect(await conn.collections.requestSubmissions.countDocuments()).toBe(
        0,
      );
      // GridFS sits outside the transaction. Keep unclaimed uploads for recovery
      // rather than risk deleting files from an ambiguously committed attempt.
      expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
    } finally {
      await db.command({ collMod: collection.collectionName, validator: {} });
      await client.close();
    }
    expect((await repo.createRequests(student, batch)).created).toBe(true);
    expect(await collection.countDocuments()).toBe(2);
  });

  test("an uncertain commit keeps committed proofs and a retry resolves to the stored IDs", async () => {
    const batch = makeBatch();
    const error = new MongoServerError({
      message: "Commit acknowledgement lost",
    });
    error.addErrorLabel("UnknownTransactionCommitResult");
    const uncertain = new RequestRepo({
      ...conn.collections,
      withTransaction: async (callback) => {
        await conn.collections.withTransaction(callback);
        throw error;
      },
    });
    const failure = await uncertain
      .createRequests(student, batch)
      .catch((error: unknown) => error);
    expect(failure).toBe(error);
    const replay = await repo.createRequests(student, batch);
    expect(replay.created).toBe(false);
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
    const request = await repo.requireRequest(replay.ids[0] ?? "");
    const opening = request.thread[0];
    if (opening?.kind !== "comment") throw new Error("Missing opening comment");
    expect(await repo.fetchProof(opening.proofs?.[0]?.id ?? "")).toBe(
      proof.content,
    );
  });

  test("rediscovering an attempt's own committed manifest preserves its proofs", async () => {
    const batch = makeBatch();
    const repeatedCallback = new RequestRepo({
      ...conn.collections,
      withTransaction: async (callback) => {
        await conn.collections.withTransaction(callback);
        return conn.collections.withTransaction(callback);
      },
    });
    const result = await repeatedCallback.createRequests(student, batch);
    expect(result.created).toBe(false);
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    expect(await conn.collections.proofs.find().toArray()).toHaveLength(2);
    const request = await repo.requireRequest(result.ids[0] ?? "");
    const opening = request.thread[0];
    if (opening?.kind !== "comment") throw new Error("Missing opening comment");
    expect(await repo.fetchProof(opening.proofs?.[0]?.id ?? "")).toBe(
      proof.content,
    );
  });

  test("mixed request types use the same storage and replay contract", async () => {
    const batch = makeBatch();
    batch.requests.push({
      request: {
        type: "Absent from Section",
        class: clazz,
        metadata: { fromSection: "L1", fromDate: "2026-10-13" },
      },
      comment: { text: "A medical appointment." },
    });
    const result = await repo.createRequests(student, batch);
    await repo.appendStatusChange(
      "ta@connect.ust.hk",
      result.ids[0] ?? "",
      { status: "approved" },
      ["open"],
      "approve",
    );
    const requests = await repo.getRequestsByID(result.ids);
    expect(requests.map((request) => request.type)).toEqual([
      "Exam Appeal",
      "Exam Appeal",
      "Absent from Section",
    ]);
    expect(requests[0]?.status).toBe("approved");
    expect(await repo.getRequestSubmission(student, batch)).toEqual({
      ids: result.ids,
      created: false,
    });
    expect(await repo.createRequests(student, batch)).toEqual({
      ids: result.ids,
      created: false,
    });
    const changed = structuredClone(batch);
    const ordinary = changed.requests[2]?.request;
    if (ordinary?.type !== "Absent from Section")
      throw new Error("Missing absence request");
    ordinary.metadata.fromDate = "2026-10-14";
    const conflict = await repo
      .createRequests(student, changed)
      .catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(RequestSubmissionConflictError);
    expect(await conn.collections.requests.countDocuments()).toBe(3);
  });
});
