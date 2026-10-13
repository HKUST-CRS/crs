import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { CommentInit, Request, RequestInit } from "service/models";
import { ClassPermissionError } from "service/services/error";

let forbidden = false;
let reads = 0;
let notifications = 0;
let received: { request: RequestInit; comment: CommentInit } | undefined;
const id = "exam-request";
const clazz = { course: { code: "COMP 9999", term: "2510" }, section: "L1" };
const input: { request: RequestInit; comment: CommentInit } = {
  request: {
    type: "Exam Appeal",
    class: clazz,
    metadata: { examCode: "midterm", question: "1" },
  },
  comment: { text: "Please check the marking." },
};
mock.module("../packages/server/services", () => ({
  services: {
    user: { auth: () => ({ sync: async () => {} }) },
    request: {
      auth: () => ({
        createRequest: async (request: RequestInit, comment: CommentInit) => {
          if (forbidden)
            throw new ClassPermissionError(
              "alice@ust.hk",
              ["student"],
              [clazz],
              "creating request",
            );
          received = { request, comment };
          return id;
        },
        getRequest: async (): Promise<Request> => {
          reads++;
          return {
            ...input.request,
            id,
            from: "alice@ust.hk",
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
  forbidden = false;
  reads = 0;
  notifications = 0;
  received = undefined;
});

test("ordinary create accepts one exam question and sends its notification", async () => {
  expect(await caller.create(input)).toBe(id);
  expect(received).toEqual(input);
  expect(reads).toBe(1);
  expect(notifications).toBe(1);
});

test("permission denial uses the normal forbidden API response", async () => {
  forbidden = true;
  const failure = await caller.create(input).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(TRPCError);
  expect((failure as TRPCError).code).toBe("FORBIDDEN");
  expect(received).toBeUndefined();
  expect(reads).toBe(0);
  expect(notifications).toBe(0);
});

test("API rejects multiple-question and forged-grader metadata before invoking creation", async () => {
  for (const metadata of [
    { examCode: "midterm", questions: ["1", "2"] },
    { examCode: "midterm", question: ["1", "2"] },
    { examCode: "midterm", question: "1", grader: "other@ust.hk" },
  ]) {
    const failure = await caller
      .create({
        ...input,
        request: { ...input.request, metadata } as unknown as RequestInit,
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TRPCError);
    expect((failure as TRPCError).code).toBe("BAD_REQUEST");
  }
  expect(received).toBeUndefined();
  expect(reads).toBe(0);
  expect(notifications).toBe(0);
});

test("API rejects an empty opening reason before invoking creation", async () => {
  const failure = await caller
    .create({ ...input, comment: { text: "" } })
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(TRPCError);
  expect((failure as TRPCError).code).toBe("BAD_REQUEST");
  expect(received).toBeUndefined();
  expect(notifications).toBe(0);
});
