import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type {
  CommentInit,
  Request,
  RequestBatch,
  RequestInit,
} from "service/models";
import { RequestSubmissionConflictError } from "service/repos/error";
import { ClassPermissionError } from "service/services/error";

let created = true;
let conflict = false;
let forbidden = false;
let reads = 0;
let notifications = 0;
let notificationFailures = true;
let received: RequestBatch | undefined;
let singleReceived: { request: RequestInit; comment: CommentInit } | undefined;
const ids: [string, string] = ["q1-ticket", "q2-ticket"];
const clazz = { course: { code: "COMP 9999", term: "2510" }, section: "L1" };
const input: RequestBatch = {
  submissionId: randomUUID(),
  requests: ["1", "2"].map((question) => ({
    request: {
      type: "Exam Appeal",
      class: clazz,
      metadata: { examCode: "midterm", question },
    },
    comment: { text: "Please check the marking." },
  })),
};
mock.module("../packages/server/services", () => ({
  services: {
    user: { auth: () => ({ sync: async () => {} }) },
    request: {
      auth: () => ({
        createRequests: async (batch: RequestBatch) => {
          received = batch;
          if (conflict) throw new RequestSubmissionConflictError();
          if (forbidden)
            throw new ClassPermissionError(
              "alice@ust.hk",
              ["student"],
              [clazz],
              "creating requests",
            );
          return { ids: ids.slice(0, batch.requests.length), created };
        },
        createRequest: async (request: RequestInit, comment: CommentInit) => {
          singleReceived = { request, comment };
          return ids[0];
        },
        getRequest: async (id: string): Promise<Request> => {
          reads++;
          return {
            id,
            from: "alice@ust.hk",
            type: "Exam Appeal",
            class: clazz,
            metadata: { examCode: "midterm", question: "1" },
            status: "open",
            timestamp: "2026-10-13T00:00:00Z",
            thread: [],
          };
        },
      }),
    },
    notification: {
      notifyRequestUpdate: async () => {
        notifications++;
        if (notificationFailures) {
          throw new Error("SMTP unavailable after commit");
        }
      },
    },
  },
}));
const { routerRequest } = await import("../packages/server/routers/request");
const caller = routerRequest.createCaller({
  user: { email: "alice@ust.hk", name: "Alice" },
});
const errors = spyOn(console, "error").mockImplementation(() => {});
const info = spyOn(console, "info").mockImplementation(() => {});
const warnings = spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => {
  errors.mockRestore();
  info.mockRestore();
  warnings.mockRestore();
});
beforeEach(() => {
  created = true;
  conflict = false;
  forbidden = false;
  reads = 0;
  notifications = 0;
  notificationFailures = true;
  received = undefined;
  singleReceived = undefined;
});

test("committed batch succeeds when each notification fails; replay sends nothing", async () => {
  expect(await caller.createMany(input)).toEqual(ids);
  expect(notifications).toBe(2);
  expect(reads).toBe(2);
  created = false;
  expect(await caller.createMany(input)).toEqual(ids);
  expect(notifications).toBe(2);
  expect(reads).toBe(2);
});

test("changed payload under a reused submission key returns an API conflict", async () => {
  conflict = true;
  const failure = await caller
    .createMany(input)
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(TRPCError);
  expect((failure as TRPCError).code).toBe("CONFLICT");
  expect(notifications).toBe(0);
});

test("permission denial uses the normal forbidden API response", async () => {
  forbidden = true;
  const failure = await caller
    .createMany(input)
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(TRPCError);
  expect((failure as TRPCError).code).toBe("FORBIDDEN");
  expect(notifications).toBe(0);
});

test("API rejects invalid cardinality and forged question fields before invoking creation", async () => {
  for (const requests of [
    [],
    [
      {
        request: {
          type: "Exam Appeal",
          class: clazz,
          metadata: { examCode: "midterm", questions: ["1", "2"] },
        },
        comment: { text: "Please check the marking." },
      },
    ],
  ]) {
    const failure = await caller
      .createMany({ ...input, requests } as unknown as RequestBatch)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TRPCError);
    expect((failure as TRPCError).code).toBe("BAD_REQUEST");
  }
  expect(notifications).toBe(0);
  expect(reads).toBe(0);
  expect(received).toBeUndefined();
});

test("ordinary request types use the same batch API", async () => {
  const ordinary: RequestBatch = {
    submissionId: randomUUID(),
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
  expect(await caller.createMany(ordinary)).toEqual(ids.slice(0, 1));
  expect(received?.requests[0]?.request.type).toBe("Absent from Section");
  expect(received?.requests[0]?.comment.text).toBe("A medical appointment.");
  expect(notifications).toBe(1);
});

test("ordinary create accepts one exam question through the usual request API", async () => {
  const entry = input.requests[0];
  if (!entry) throw new Error("Missing request");
  notificationFailures = false;
  expect(await caller.create(entry)).toBe(ids[0]);
  expect(singleReceived).toEqual(entry);
  expect(notifications).toBe(1);
});

test("mixed exam and ordinary requests reach the same batch operation", async () => {
  const first = input.requests[0];
  if (!first) throw new Error("Missing exam request");
  const mixed: RequestBatch = {
    submissionId: randomUUID(),
    requests: [
      first,
      {
        request: {
          type: "Absent from Section",
          class: clazz,
          metadata: { fromSection: "L1", fromDate: "2026-10-13" },
        },
        comment: { text: "A medical appointment." },
      },
    ],
  };
  expect(await caller.createMany(mixed)).toEqual(ids);
  expect(received).toEqual(mixed);
  expect(notifications).toBe(2);
});
