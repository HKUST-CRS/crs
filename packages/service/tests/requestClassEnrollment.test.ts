import { afterAll, beforeAll, expect, test } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import { Course, type RequestInit, type User } from "../models";
import { createRepos } from "../repos";
import { RequestService } from "../services";
import { ClassPermissionError, InvalidRequestError } from "../services/error";
import { insertData } from "./tests";

// Enrollment classes route requests to their instructors. The configured
// sections describe the lab/tutorial schedules that request metadata targets.
const course = Course.parse({
  code: "COMP 1023",
  term: "2610",
  title: "Request class regression fixture",
  sections: {
    LA1: { schedule: [{ day: 1, from: "18:00", to: "19:50" }] },
    LA5: { schedule: [{ day: 5, from: "18:00", to: "19:50" }] },
  },
  assignments: {
    PA1: {
      name: "Programming assignment 1",
      due: "2026-10-16T10:00:00+08:00",
      maxExtension: "PT24H",
    },
  },
  exams: { Midterm: { questions: { Q1: { grader: "grader@ust.hk" } } } },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Exam Appeal": true,
    "Exam Special Arrangement": true,
  },
});
const crossWeekCourse = Course.parse({
  ...course,
  code: "COMP 2012",
  sections: {
    LA1: { schedule: [{ day: 1, from: "18:00", to: "19:50" }] },
    LA3: { schedule: [{ day: 4, from: "18:00", to: "19:50" }] },
  },
});
const clazz = {
  course: { code: course.code, term: course.term },
  section: "L3",
};
const crossWeekClass = {
  course: { code: crossWeekCourse.code, term: crossWeekCourse.term },
  section: "L3",
};
const student: User = {
  email: "request-regression@connect.ust.hk",
  name: "Synthetic request regression student",
  enrollment: [
    { ...clazz, role: "student" },
    { ...crossWeekClass, role: "student" },
  ],
  sudoer: false,
};
const grader: User = {
  email: "grader@ust.hk",
  name: "Synthetic grader",
  enrollment: [{ ...clazz, role: "grader" }],
  sudoer: false,
};
const inputs: RequestInit[] = [
  {
    type: "Absent from Section",
    class: clazz,
    metadata: { fromSection: "LA5", fromDate: "2026-10-16" },
  },
  {
    type: "Swap Section",
    class: clazz,
    metadata: {
      fromSection: "LA5",
      fromDate: "2026-10-16",
      toSection: "LA1",
      toDate: "2026-10-19",
    },
  },
  {
    type: "Deadline Extension",
    class: clazz,
    metadata: { assignment: "PA1", deadline: "2026-10-17T10:00:00+08:00" },
  },
  {
    type: "Exam Appeal",
    class: clazz,
    metadata: { examCode: "Midterm", question: "Q1" },
  },
  {
    type: "Exam Special Arrangement",
    class: clazz,
    metadata: { examCode: "Midterm" },
  },
];
const comment = { text: "Synthetic regression request.", proofs: [] };

let server: MongoMemoryReplSet;
let conn: DbConn;
let requests: RequestService;

beforeAll(async () => {
  server = await MongoMemoryReplSet.create({
    replSet: { storageEngine: "wiredTiger" },
  });
  conn = await DbConn.create(server.getUri());
  requests = new RequestService(createRepos(conn.collections));
  await insertData(conn, {
    courses: [course, crossWeekCourse],
    users: [student, grader],
  });
}, 120_000);

afterAll(async () => {
  await conn?.close();
  await server?.stop();
});

async function expectCreated(input: RequestInit) {
  const result = await requests
    .auth(student.email)
    .createRequest(input, comment)
    .catch((error: unknown) => error);
  if (result instanceof Error) {
    throw new Error(
      `Expected ${input.type} for enrolled ${input.class.section} to succeed (TZ=${process.env.TZ ?? "system"}); received ${result.name}: ${result.message}`,
      { cause: result },
    );
  }
  expect(typeof result).toBe("string");
  const saved = await requests.auth(student.email).getRequest(result as string);
  expect(saved.class).toEqual(input.class);
  expect(saved.metadata).toEqual(input.metadata);
  expect(saved.status).toBe("open");
}

for (const input of inputs) {
  test(`${input.type} accepts an enrolled lecture class without a configured schedule`, async () => {
    await expectCreated(input);
  });
}

test("accepts the reported COMP 2012 swap from Thursday October 22 to Monday October 26", async () => {
  await expectCreated({
    type: "Swap Section",
    class: crossWeekClass,
    metadata: {
      fromSection: "LA3",
      fromDate: "2026-10-22",
      toSection: "LA1",
      toDate: "2026-10-26",
    },
  });
});

test("still rejects requests for a class the student is not enrolled in", async () => {
  const before = await conn.collections.requests.countDocuments();
  const result = await requests
    .auth(student.email)
    .createRequest(
      {
        type: "Absent from Section",
        class: { ...clazz, section: "L4" },
        metadata: { fromSection: "LA5", fromDate: "2026-10-16" },
      },
      comment,
    )
    .catch((error: unknown) => error);
  expect(result).toBeInstanceOf(ClassPermissionError);
  expect(await conn.collections.requests.countDocuments()).toBe(before);
});

test("still rejects unknown or inherited target lab names before saving", async () => {
  const before = await conn.collections.requests.countDocuments();
  for (const fromSection of [
    "unknown",
    "toString",
    "constructor",
    "__proto__",
  ]) {
    const result = await requests
      .auth(student.email)
      .createRequest(
        {
          type: "Absent from Section",
          class: clazz,
          metadata: { fromSection, fromDate: "2026-10-16" },
        },
        comment,
      )
      .catch((error: unknown) => error);
    expect(result).toBeInstanceOf(InvalidRequestError);
  }
  expect(await conn.collections.requests.countDocuments()).toBe(before);
});

test("still rejects an absence date outside the target lab schedule before saving", async () => {
  const before = await conn.collections.requests.countDocuments();
  const result = await requests
    .auth(student.email)
    .createRequest(
      {
        type: "Absent from Section",
        class: clazz,
        metadata: { fromSection: "LA5", fromDate: "2026-10-15" },
      },
      comment,
    )
    .catch((error: unknown) => error);
  expect(result).toBeInstanceOf(InvalidRequestError);
  expect(await conn.collections.requests.countDocuments()).toBe(before);
});
