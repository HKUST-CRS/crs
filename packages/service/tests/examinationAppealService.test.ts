import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { randomUUID } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { DbConn } from "../db";
import {
  Course,
  type ExaminationAppealBatch,
  type Role,
  type User,
} from "../models";
import { createRepos } from "../repos";
import { CourseService, RequestService } from "../services";
import {
  ClassPermissionError,
  InvalidRequestError,
  PermissionError,
  RequestTypeNotEffectiveError,
} from "../services/error";
import { clearData, insertData } from "./tests";

const course = Course.parse({
  code: "COMP 9999",
  term: "2510",
  title: "Examination Appeal Testing",
  sections: { L1: { schedule: [] } },
  assignments: {},
  examinations: {
    Midterm: {
      questions: [
        { questionNumber: "1", taId: "bob@ust.hk" },
        { questionNumber: "2", taId: "carol@ust.hk" },
      ],
    },
  },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Examination Appeal": true,
  },
});
const clazz = {
  course: { code: course.code, term: course.term },
  section: "L1",
};
function user(email: string, role: Role | null): User {
  return {
    email,
    name: email.split("@")[0] ?? email,
    enrollment: role ? [{ ...clazz, role }] : [],
    sudoer: false,
  };
}
const student = user("alice@ust.hk", "student");
// Bob is also a student: reviewing assigned work must not leak into his own-request inbox.
const bob = user("bob@ust.hk", "student");
const carol = user("carol@ust.hk", null);
const instructor = user("instructor@ust.hk", "instructor");
const observer = user("observer@ust.hk", "observer");
const admin = user("admin@ust.hk", "admin");
const proof = {
  name: "answer.txt",
  size: 2,
  content: Buffer.from("hi").toString("base64"),
};
function batch(questionNumbers = ["1", "2"]): ExaminationAppealBatch {
  return {
    submissionId: randomUUID(),
    class: clazz,
    appeals: questionNumbers.map((questionNumber) => ({
      examCode: "Midterm",
      questionNumber,
      comment: {
        text: `Please review question ${questionNumber}.`,
        proofs: [proof],
      },
    })),
  };
}

async function expectFailure(
  promise: Promise<unknown>,
  expected: new (...args: never[]) => Error = Error,
) {
  // Bun's pending-promise .rejects matcher blocks MongoDB I/O in this version.
  const failure = await promise.catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(expected);
}

describe("Examination appeals use exact-question thread permissions", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let requests: RequestService;
  let courses: CourseService;
  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    conn = await DbConn.create(memoryServer.getUri());
    const repos = createRepos(conn.collections);
    requests = new RequestService(repos);
    courses = new CourseService(repos);
  });
  afterAll(async () => {
    await conn.close();
    await memoryServer.stop();
  });
  beforeEach(async () => {
    await clearData(conn);
    await insertData(conn, {
      courses: [course],
      users: [student, bob, carol, instructor, observer, admin],
    });
  });

  test("creates one question per thread and replay returns the same tickets", async () => {
    const input = batch();
    const created = await requests
      .auth(student.email)
      .createExaminationAppeals(input);
    expect(created.created).toBe(true);
    expect(created.ids).toHaveLength(2);
    for (const [index, id] of created.ids.entries()) {
      const ticket = await requests.auth(student.email).getRequest(id);
      expect(ticket.metadata).toEqual({
        examCode: "Midterm",
        questionNumber: `${index + 1}`,
      });
      expect(ticket.status).toBe("open");
      expect(ticket.thread).toHaveLength(1);
      expect(ticket.thread[0]?.kind).toBe("comment");
    }
    expect(
      await requests.auth(student.email).createExaminationAppeals(input),
    ).toEqual({ ids: created.ids, created: false });
    expect(await conn.collections.requests.countDocuments()).toBe(2);
    // A lost-response retry retrieves the committed result even if eligibility
    // or the catalog changes after the original submission.
    await conn.collections.courses.updateOne(clazz.course, {
      $set: {
        examinations: {},
        "effectiveRequestTypes.Examination Appeal": false,
      },
    });
    await conn.collections.users.updateOne(
      { email: student.email },
      { $set: { enrollment: [] } },
    );
    expect(
      await requests.auth(student.email).createExaminationAppeals(input),
    ).toEqual({ ids: created.ids, created: false });
  });

  test("assigned TA can open, bulk-read, comment, decide and download only their question", async () => {
    const { ids } = await requests
      .auth(student.email)
      .createExaminationAppeals(batch());
    const q1 = ids[0] as string;
    const q2 = ids[1] as string;
    const svc = requests.auth(bob.email);
    const ticket = await svc.getRequest(q1);
    const opening = ticket.thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing opening proof");
    expect(await svc.fetchProof(opening.proofs[0].id)).toEqual({
      content: proof.content,
    });
    expect(
      (await svc.getRequestsByID([q1])).map((request) => request.id),
    ).toEqual([q1]);
    await svc.comment(q1, { text: "Reviewing the rubric." });
    await svc.approve(q1, { text: "Mark corrected." });
    expect(
      (await svc.getRequest(q1)).thread.map((entry) => entry.kind),
    ).toEqual(["comment", "comment", "comment", "status"]);
    await expectFailure(svc.getRequest(q2), ClassPermissionError);
    await expectFailure(svc.getRequestsByID([q1, q2]), ClassPermissionError);
    await expectFailure(
      svc.comment(q2, { text: "Not my question" }),
      ClassPermissionError,
    );
    await expectFailure(svc.approve(q2), ClassPermissionError);
    const other = await requests.auth(student.email).getRequest(q2);
    const otherOpening = other.thread[0];
    if (otherOpening?.kind !== "comment" || !otherOpening.proofs?.[0])
      throw new Error("Missing other proof");
    await expectFailure(
      svc.fetchProof(otherOpening.proofs[0].id),
      ClassPermissionError,
    );
    expect(
      (await svc.getAssignedExaminationAppeals()).map((request) => request.id),
    ).toEqual([q1]);
    expect(await svc.getRequestsAs(["student"])).toEqual([]);
    expect(
      (await requests.auth(carol.email).getAssignedExaminationAppeals()).map(
        (request) => request.id,
      ),
    ).toEqual([q2]);
  });

  test("ordinary class roles retain access and admin-only does not gain it", async () => {
    const { ids } = await requests
      .auth(student.email)
      .createExaminationAppeals(batch(["1"]));
    const id = ids[0] as string;
    expect((await requests.auth(observer.email).getRequest(id)).id).toBe(id);
    await expectFailure(
      requests.auth(observer.email).comment(id, { text: "Observer note" }),
      ClassPermissionError,
    );
    await expectFailure(
      requests.auth(observer.email).reject(id),
      ClassPermissionError,
    );
    await requests.auth(instructor.email).reject(id);
    for (const operation of [
      () => requests.auth(admin.email).getRequest(id),
      () => requests.auth(admin.email).getContext(id),
      () => requests.auth(admin.email).comment(id, { text: "Admin note" }),
      () => requests.auth(admin.email).approve(id),
    ])
      await expectFailure(operation(), ClassPermissionError);
    expect(await requests.auth(admin.email).getRequestsAs(["admin"])).toEqual(
      [],
    );
    expect(
      await requests.auth(observer.email).getRequestsAs(["observer"]),
    ).toHaveLength(1);
    expect(
      await requests.auth(instructor.email).getRequestsAs(["instructor"]),
    ).toHaveLength(1);
  });

  test("requester cannot decide their own appeal even with TA and instructor authority", async () => {
    await conn.collections.users.updateOne(
      { email: bob.email },
      { $push: { enrollment: { ...clazz, role: "instructor" } } },
    );
    const { ids } = await requests
      .auth(bob.email)
      .createExaminationAppeals(batch(["1"]));
    const id = ids[0] as string;
    await expectFailure(requests.auth(bob.email).approve(id), PermissionError);
    await expectFailure(requests.auth(bob.email).reject(id), PermissionError);
    expect((await requests.auth(bob.email).getContext(id)).canDecide).toBe(
      false,
    );
  });

  test("scoped context works for unenrolled TA and includes only actual thread authors", async () => {
    const { ids } = await requests
      .auth(student.email)
      .createExaminationAppeals(batch(["2"]));
    const id = ids[0] as string;
    await requests
      .auth(carol.email)
      .comment(id, { text: "Checking the answer." });
    const context = await requests.auth(carol.email).getContext(id);
    expect(context).toEqual({
      courseTitle: course.title,
      assignedTA: { email: carol.email, name: carol.name },
      authors: [
        { email: student.email, name: student.name },
        { email: carol.email, name: carol.name },
      ],
      canComment: true,
      canDecide: true,
      canAppeal: false,
    });
    await expectFailure(
      requests.auth(bob.email).getContext(id),
      ClassPermissionError,
    );
  });

  test("reassignment updates both inbox and all access paths", async () => {
    const { ids } = await requests
      .auth(student.email)
      .createExaminationAppeals(batch(["1"]));
    const id = ids[0] as string;
    await courses.auth(instructor.email).updateExaminations(clazz.course, {
      Midterm: { questions: [{ questionNumber: "1", taId: carol.email }] },
    });
    expect(
      await requests.auth(bob.email).getAssignedExaminationAppeals(),
    ).toEqual([]);
    await expectFailure(
      requests.auth(bob.email).getRequest(id),
      ClassPermissionError,
    );
    expect((await requests.auth(carol.email).getRequest(id)).id).toBe(id);
  });

  test("ordinary thread lifecycle supports decision, review, redecision and cancellation", async () => {
    const { ids } = await requests
      .auth(student.email)
      .createExaminationAppeals(batch(["1"]));
    const id = ids[0] as string;
    await requests.auth(bob.email).approve(id);
    expect((await requests.auth(student.email).getContext(id)).canAppeal).toBe(
      true,
    );
    await requests
      .auth(student.email)
      .appeal(id, { text: "Please check the missing rubric point." });
    await requests.auth(bob.email).reject(id, { text: "Checked again." });
    await requests.auth(student.email).cancel(id);
    expect((await requests.auth(student.email).getRequest(id)).status).toBe(
      "cancelled",
    );
    expect((await requests.auth(bob.email).getContext(id)).canDecide).toBe(
      false,
    );
  });

  test("rejects missing exam/question/section, disabled type and missing student enrollment before saving", async () => {
    const invalidInputs = [
      {
        ...batch(["1"]),
        appeals: [{ ...batch(["1"]).appeals[0], examCode: "Final" }],
      },
      batch(["999"]),
      { ...batch(["1"]), class: { ...clazz, section: "NOPE" } },
    ] as ExaminationAppealBatch[];
    await conn.collections.users.updateOne(
      { email: student.email },
      { $set: { "enrollment.0.section": "*" } },
    );
    for (const input of invalidInputs)
      await expectFailure(
        requests.auth(student.email).createExaminationAppeals(input),
        InvalidRequestError,
      );
    await conn.collections.courses.updateOne(clazz.course, {
      $set: { "effectiveRequestTypes.Examination Appeal": false },
    });
    await expectFailure(
      requests.auth(student.email).createExaminationAppeals(batch(["1"])),
      RequestTypeNotEffectiveError,
    );
    await expectFailure(
      requests.auth(carol.email).createExaminationAppeals(batch(["1"])),
      ClassPermissionError,
    );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
    expect(await conn.collections.requestSubmissions.countDocuments()).toBe(0);
  });

  test("rejects empty/duplicate/oversized/forged batches and direct single create", async () => {
    const valid = batch(["1"]);
    for (const malformed of [
      { ...valid, appeals: [] },
      batch(["1", "1"]),
      {
        ...valid,
        appeals: Array.from({ length: 51 }, (_, index) => ({
          ...valid.appeals[0],
          questionNumber: `${index}`,
        })),
      },
      { ...valid, appeals: [{ ...valid.appeals[0], taId: bob.email }] },
      {
        ...valid,
        appeals: [{ ...valid.appeals[0], questionNumbers: ["1", "2"] }],
      },
    ])
      await expectFailure(
        requests
          .auth(student.email)
          .createExaminationAppeals(malformed as ExaminationAppealBatch),
      );
    await expectFailure(
      requests.auth(student.email).createRequest(
        {
          type: "Examination Appeal",
          class: clazz,
          metadata: { examCode: "Midterm", questionNumber: "1" },
        },
        { text: "Direct bypass" },
      ),
      InvalidRequestError,
    );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
  });

  test("server validates TA addresses and duplicate catalog questions before updating", async () => {
    for (const examinations of [
      { Midterm: { questions: [{ questionNumber: "1", taId: "invalid" }] } },
      {
        Midterm: {
          questions: [
            { questionNumber: "1", taId: bob.email },
            { questionNumber: "1", taId: carol.email },
          ],
        },
      },
    ])
      await expectFailure(
        courses
          .auth(instructor.email)
          .updateExaminations(clazz.course, examinations),
      );
    await expectFailure(
      courses
        .auth(student.email)
        .updateExaminations(clazz.course, course.examinations),
    );
    expect(
      (await courses.auth(instructor.email).getCourse(clazz.course))
        .examinations,
    ).toEqual(course.examinations);
    await conn.collections.courses.updateOne(clazz.course, {
      $set: { "examinations.Midterm.questions.0.taId": "invalid" },
    });
    await expectFailure(
      requests.auth(student.email).createExaminationAppeals(batch(["1"])),
    );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
  });
});
