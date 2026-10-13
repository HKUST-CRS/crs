import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import nodemailer, { type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import Papa from "papaparse";
import { ZodError } from "zod";
import { DbConn } from "../db";
import {
  Course,
  Request,
  type RequestInit,
  RequestSerialization,
  type Role,
  type User,
} from "../models";
import { Signature } from "../models/request/Signature";
import { createRepos, type Repos } from "../repos";
import { NotificationService, RequestService } from "../services";
import {
  ClassPermissionError,
  InvalidRequestError,
  PermissionError,
  RequestTypeNotEffectiveError,
} from "../services/error";
import { clearData, insertData } from "./tests";

const course = Course.parse({
  code: "COMP 8888",
  term: "2610",
  title: "Exam Arrangement Testing",
  sections: { L1: { schedule: [] }, L2: { schedule: [] } },
  assignments: {},
  exams: {
    midterm: { questions: {} },
    final: { questions: { Q1: { grader: "grader@ust.hk" } } },
  },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Exam Appeal": true,
    "Exam Special Arrangement": true,
  },
});
const clazz = {
  course: { code: course.code, term: course.term },
  section: "L1",
};
function user(email: string, role: Role, section = "L1"): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: [{ ...clazz, section, role }],
    sudoer: false,
  };
}
const student = user("student@connect.ust.hk", "student");
const instructor = user("instructor@ust.hk", "instructor");
const observer = user("observer@ust.hk", "observer");
const grader = user("grader@ust.hk", "grader");
const otherStudent = user("other@connect.ust.hk", "student", "L2");
const otherInstructor = user("other-instructor@ust.hk", "instructor", "L2");
const input: RequestInit = {
  type: "Exam Special Arrangement",
  class: clazz,
  metadata: { examCode: "midterm" },
};
const proof = {
  name: "appointment.txt",
  size: 2,
  content: Buffer.from("hi").toString("base64"),
};
const comment = {
  text: "I have a medical appointment during the exam. May I take a makeup exam?",
  proofs: [proof],
};
async function expectFailure(
  promise: Promise<unknown>,
  errorType: new (...args: never[]) => Error,
) {
  const error = await promise.catch((error: unknown) => error);
  expect(error).toBeInstanceOf(errorType);
}

describe("Exam special arrangements use the normal request thread", () => {
  let server: MongoMemoryReplSet;
  let conn: DbConn;
  let repos: Repos;
  let requests: RequestService;
  beforeAll(async () => {
    server = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    conn = await DbConn.create(server.getUri());
    repos = createRepos(conn.collections);
    requests = new RequestService(repos);
  }, 120_000);
  afterAll(async () => {
    await conn?.close();
    await server?.stop();
  });
  beforeEach(async () => {
    await clearData(conn);
    await insertData(conn, {
      courses: [course],
      users: [
        student,
        instructor,
        observer,
        grader,
        otherStudent,
        otherInstructor,
      ],
    });
  });

  test("accepts an exam without questions and stores details/proofs only in the opening comment", async () => {
    const id = await requests
      .auth(student.email)
      .createRequest(
        { ...input, metadata: { examCode: " midterm " } },
        { ...comment, text: `  ${comment.text}  ` },
      );
    const saved = await requests.auth(student.email).getRequest(id);
    expect(Request.safeParse(saved).success).toBe(true);
    expect(saved.metadata).toEqual({ examCode: "midterm" });
    expect(saved.thread).toHaveLength(1);
    expect(saved.thread[0]).toMatchObject({
      kind: "comment",
      text: comment.text,
      proofs: [{ name: proof.name }],
    });
    const opening = saved.thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing proof");
    expect(
      await requests.auth(observer.email).fetchProof(opening.proofs[0].id),
    ).toEqual({ content: proof.content });
    expect((await conn.collections.requests.findOne({ id }))?.metadata).toEqual(
      { examCode: "midterm" },
    );
    const row = Papa.parse<{ Exam: string; Question: string; Type: string }>(
      RequestSerialization.toCSV([saved], "https://crs.test"),
      { header: true },
    ).data[0];
    expect(row).toMatchObject({
      Exam: "midterm",
      Question: "",
      Type: "Exam Special Arrangement",
    });
  });

  test("rejects missing/unknown/prototype exams, forged metadata, empty reasons and disabled type before saving", async () => {
    for (const examCode of ["unknown", "constructor", "__proto__"])
      await expectFailure(
        requests
          .auth(student.email)
          .createRequest({ ...input, metadata: { examCode } }, comment),
        InvalidRequestError,
      );
    for (const metadata of [
      {},
      { examCode: " " },
      { examCode: "midterm", question: "Q1" },
      { examCode: "midterm", reason: "Medical appointment" },
      { examCode: "midterm", proofs: [] },
      { examCode: "midterm", arrangement: "Makeup" },
    ])
      await expectFailure(
        requests
          .auth(student.email)
          .createRequest(
            { ...input, metadata } as unknown as RequestInit,
            comment,
          ),
        ZodError,
      );
    for (const text of ["", "  "])
      await expectFailure(
        requests.auth(student.email).createRequest(input, { ...comment, text }),
        ZodError,
      );
    await conn.collections.users.updateOne(
      { email: student.email },
      { $set: { "enrollment.0.section": "*" } },
    );
    await expectFailure(
      requests
        .auth(student.email)
        .createRequest(
          { ...input, class: { ...clazz, section: "UNKNOWN" } },
          comment,
        ),
      InvalidRequestError,
    );
    await conn.collections.courses.updateOne(clazz.course, {
      $set: { exams: {} },
    });
    await expectFailure(
      requests.auth(student.email).createRequest(input, comment),
      InvalidRequestError,
    );
    await conn.collections.courses.updateOne(clazz.course, {
      $set: {
        exams: course.exams,
        "effectiveRequestTypes.Exam Special Arrangement": false,
      },
    });
    await expectFailure(
      requests.auth(student.email).createRequest(input, comment),
      RequestTypeNotEffectiveError,
    );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
    expect(await conn.collections.proofs.find().toArray()).toEqual([]);
  });

  test("only students in the target class can create; observers read and assigned question graders gain no access", async () => {
    for (const actor of [instructor, observer, grader, otherStudent])
      await expectFailure(
        requests.auth(actor.email).createRequest(input, comment),
        ClassPermissionError,
      );
    const id = await requests
      .auth(student.email)
      .createRequest({ ...input, metadata: { examCode: "final" } }, comment);
    expect((await requests.auth(observer.email).getRequest(id)).id).toBe(id);
    expect(await requests.auth(observer.email).getContext(id)).toMatchObject({
      canComment: false,
      canDecide: false,
      assignedGrader: null,
    });
    for (const actor of [student, observer]) {
      const denial = actor === student ? PermissionError : ClassPermissionError;
      await expectFailure(requests.auth(actor.email).approve(id), denial);
      await expectFailure(requests.auth(actor.email).reject(id), denial);
    }
    await expectFailure(
      requests.auth(observer.email).comment(id, { text: "Observer comment" }),
      ClassPermissionError,
    );
    const opening = (await requests.auth(student.email).getRequest(id))
      .thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing proof");
    for (const actor of [grader, otherInstructor, otherStudent]) {
      const service = requests.auth(actor.email);
      for (const operation of [
        () => service.getRequest(id),
        () => service.getRequestsByID([id]),
        () => service.getContext(id),
        () => service.fetchProof(opening.proofs?.[0]?.id as string),
        () => service.comment(id, { text: "Unauthorized" }),
        () => service.approve(id),
      ])
        await expectFailure(operation(), ClassPermissionError);
    }
    expect(await requests.auth(grader.email).getRequestsAs(["grader"])).toEqual(
      [],
    );
  });

  test("instructors decide and students cancel through the existing immutable thread workflow", async () => {
    const id = await requests.auth(student.email).createRequest(input, comment);
    await requests
      .auth(student.email)
      .comment(id, { text: "My supporting document is attached above." });
    await requests
      .auth(instructor.email)
      .approve(id, { text: "A makeup exam is approved." });
    expect((await requests.auth(student.email).getRequest(id)).status).toBe(
      "approved",
    );
    await requests.auth(student.email).cancel(id);
    const saved = await requests.auth(instructor.email).getRequest(id);
    expect(saved.status).toBe("cancelled");
    expect(saved.metadata).toEqual(input.metadata);
    expect(saved.thread.map((entry) => entry.kind)).toEqual([
      "comment",
      "comment",
      "comment",
      "status",
      "status",
    ]);
    expect(
      (await requests.auth(instructor.email).getContext(id)).canDecide,
    ).toBe(false);
  });

  test("a requester cannot decide their own arrangement even when enrolled as an instructor", async () => {
    await conn.collections.users.updateOne(
      { email: student.email },
      { $push: { enrollment: { ...clazz, role: "instructor" } } },
    );
    const id = await requests.auth(student.email).createRequest(input, comment);
    await expectFailure(
      requests.auth(student.email).approve(id),
      PermissionError,
    );
    await expectFailure(
      requests.auth(student.email).reject(id),
      PermissionError,
    );
    expect((await requests.auth(student.email).getContext(id)).canDecide).toBe(
      false,
    );
  });

  test("notifications contain the exam and thread reason, go to class staff, and exclude question graders", async () => {
    const id = await requests
      .auth(student.email)
      .createRequest({ ...input, metadata: { examCode: "final" } }, comment);
    const saved = await requests.auth(student.email).getRequest(id);
    const sent: Mail.Options[] = [];
    const transport = spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: mock(async (mail: Mail.Options) => {
        sent.push(mail);
        return {};
      }),
    } as unknown as Transporter);
    const signature = spyOn(Signature, "sign").mockResolvedValue(
      "test-signature",
    );
    const keys = ["SMTP_HOST", "SMTP_PORT", "EMAIL_FROM", "BASE_URL"] as const;
    const previous = keys.map((key) => Bun.env[key]);
    Object.assign(Bun.env, {
      SMTP_HOST: "smtp.invalid",
      SMTP_PORT: "465",
      EMAIL_FROM: "test@ust.hk",
      BASE_URL: "https://crs.test",
    });
    try {
      const notifications = new NotificationService(repos);
      await notifications.notifyRequestUpdate(saved);
      expect(sent[0]?.to).toEqual([instructor.email]);
      expect(sent[0]?.cc).toEqual([student.email, observer.email]);
      expect(sent[0]?.subject).toContain("final");
      expect(sent[0]?.html).toContain("special arrangement for exam final");
      expect(sent[0]?.html).toContain(comment.text);
      expect(sent[0]?.attachments?.[0]).toMatchObject({ filename: proof.name });
      const entries = await requests
        .auth(instructor.email)
        .approve(id, { text: "Approved makeup." });
      await notifications.notifyRequestUpdate(
        await requests.auth(instructor.email).getRequest(id),
        entries,
      );
      expect(sent[1]?.to).toEqual([student.email]);
      expect(sent[1]?.cc).toEqual([instructor.email, observer.email]);
      expect(JSON.stringify(sent)).not.toContain(grader.email);
      expect(JSON.stringify(sent)).not.toContain(otherInstructor.email);
    } finally {
      transport.mockRestore();
      signature.mockRestore();
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete Bun.env[key];
        else Bun.env[key] = previous[index];
      });
    }
  });
});
