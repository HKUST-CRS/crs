import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { ExaminationAppealBatch, Request } from "service/models";
import { RequestSubmissionConflictError } from "service/repos/error";

let created = true;
let conflict = false;
let reads = 0;
let notifications = 0;
const ids = ["q1-ticket", "q2-ticket"];
const input: ExaminationAppealBatch = {
  submissionId: randomUUID(),
  class: { course: { code: "COMP 9999", term: "2510" }, section: "L1" },
  appeals: ["1", "2"].map((questionNumber) => ({
    examCode: "Midterm",
    questionNumber,
    comment: { text: "Please check the marking." },
  })),
};
mock.module("../services", () => ({
  services: {
    user: { auth: () => ({ sync: async () => {} }) },
    request: {
      auth: () => ({
        createExaminationAppeals: async () => {
          if (conflict) throw new RequestSubmissionConflictError();
          return { ids, created };
        },
        getRequest: async (id: string): Promise<Request> => {
          reads++;
          return {
            id,
            from: "alice@ust.hk",
            type: "Examination Appeal",
            class: input.class,
            metadata: { examCode: "Midterm", questionNumber: "1" },
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
        throw new Error("SMTP unavailable after commit");
      },
    },
  },
}));
const { routerRequest } = await import("../routers/request");
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
  reads = 0;
  notifications = 0;
});

test("committed batch succeeds when each notification fails; replay sends nothing", async () => {
  expect(await caller.createExaminationAppeals(input)).toEqual(ids);
  expect(notifications).toBe(2);
  expect(reads).toBe(2);
  created = false;
  expect(await caller.createExaminationAppeals(input)).toEqual(ids);
  expect(notifications).toBe(2);
  expect(reads).toBe(2);
});

test("changed payload under a reused submission key returns an API conflict", async () => {
  conflict = true;
  const failure = await caller
    .createExaminationAppeals(input)
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(TRPCError);
  expect((failure as TRPCError).code).toBe("CONFLICT");
  expect(notifications).toBe(0);
});

test("API rejects invalid cardinality and forged question fields before invoking creation", async () => {
  for (const appeals of [
    [],
    [{ ...input.appeals[0], questionNumbers: ["1", "2"] }],
  ]) {
    const failure = await caller
      .createExaminationAppeals({ ...input, appeals } as ExaminationAppealBatch)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TRPCError);
    expect((failure as TRPCError).code).toBe("BAD_REQUEST");
  }
  expect(notifications).toBe(0);
  expect(reads).toBe(0);
});
