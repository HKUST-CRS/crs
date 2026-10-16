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
import { Course, type RequestInit, type Role, type User } from "../models";
import { createRepos } from "../repos";
import { CourseService, RequestService, UserService } from "../services";
import {
  ClassPermissionError,
  InvalidRequestError,
  RequestTypeNotEffectiveError,
} from "../services/error";
import { clearData, insertData } from "./tests";

const course = Course.parse({
  code: "COMP 9999",
  term: "2510",
  title: "Exam Appeal Testing",
  sections: { L1: { schedule: [] }, L2: { schedule: [] } },
  assignments: {},
  exams: {
    Midterm: {
      questions: {
        "1": { grader: "bob@ust.hk" },
        "2": { grader: "carol@ust.hk" },
      },
    },
  },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Exam Appeal": true,
    "Exam Special Arrangement": false,
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
bob.enrollment.push({ ...clazz, role: "grader" });
const carol = user("carol@ust.hk", "grader");
const instructor = user("instructor@ust.hk", "instructor");
const observer = user("observer@ust.hk", "observer");
const admin = user("admin@ust.hk", "admin");
const proof = {
  name: "answer.txt",
  size: 2,
  content: Buffer.from("hi").toString("base64"),
};
function appeal(question = "1") {
  return {
    request: {
      type: "Exam Appeal" as const,
      class: { ...clazz, course: { ...clazz.course } },
      metadata: { examCode: "Midterm", question },
    },
    comment: {
      text: `Please review question ${question}.`,
      proofs: [proof],
    },
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

describe("Exam appeals use exact-question thread permissions", () => {
  let conn: DbConn;
  let memoryServer: MongoMemoryReplSet;
  let requests: RequestService;
  let courses: CourseService;
  let users: UserService;
  async function createAppeal(question = "1", from = student.email) {
    const input = appeal(question);
    return requests.auth(from).createRequest(input.request, input.comment);
  }
  beforeAll(async () => {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: "wiredTiger" },
    });
    conn = await DbConn.create(memoryServer.getUri());
    const repos = createRepos(conn.collections);
    requests = new RequestService(repos);
    courses = new CourseService(repos);
    users = new UserService(repos);
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

  test("creates one question per request with its opening reason and proof", async () => {
    const input = appeal();
    const id = await requests.auth(student.email).createRequest(input.request, {
      ...input.comment,
      text: `  ${input.comment.text}  `,
    });
    const ticket = await requests.auth(student.email).getRequest(id);
    expect(ticket.metadata).toEqual({ examCode: "Midterm", question: "1" });
    expect(ticket.status).toBe("open");
    expect(ticket.thread).toHaveLength(1);
    expect(ticket.thread[0]).toMatchObject({
      kind: "comment",
      from: student.email,
      text: appeal().comment.text,
      proofs: [{ name: proof.name, size: proof.size }],
    });
    expect(await conn.collections.requests.countDocuments()).toBe(1);
  });

  test("rejects empty and whitespace-only exam reasons before storing proofs", async () => {
    const input = appeal();
    for (const text of ["", "  "])
      await expectFailure(
        requests
          .auth(student.email)
          .createRequest(input.request, { ...input.comment, text }),
      );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
    expect(await conn.collections.proofs.find({}).toArray()).toEqual([]);
  });

  test("enrolled assigned grader can open, bulk-read, comment, decide and download only their question", async () => {
    const q1 = await createAppeal();
    const q2 = await createAppeal("2");
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
      (await svc.getRequestsAs(["grader"])).map((request) => request.id),
    ).toEqual([q1]);
    expect(await svc.getRequestsAs(["student"])).toEqual([]);
    expect(
      (await requests.auth(carol.email).getRequestsAs(["grader"])).map(
        (request) => request.id,
      ),
    ).toEqual([q2]);
  });

  test("ordinary class roles retain access and admin-only does not gain it", async () => {
    const id = await createAppeal("1");
    expect((await requests.auth(student.email).getContext(id)).canDecide).toBe(
      false,
    );
    await expectFailure(
      requests.auth(student.email).approve(id),
      ClassPermissionError,
    );
    await expectFailure(
      requests.auth(student.email).reject(id),
      ClassPermissionError,
    );
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

  test("requesters can decide their own appeal when authorized as its grader or class instructor", async () => {
    const id = await createAppeal("1", bob.email);
    expect((await requests.auth(bob.email).getContext(id)).canDecide).toBe(
      true,
    );
    await requests.auth(bob.email).approve(id);
    expect((await requests.auth(bob.email).getRequest(id)).status).toBe(
      "approved",
    );
    await conn.collections.users.updateOne(
      { email: bob.email },
      { $push: { enrollment: { ...clazz, role: "instructor" } } },
    );
    await users
      .auth(instructor.email)
      .deleteEnrollment(bob.email, { ...clazz, role: "grader" });
    expect((await requests.auth(bob.email).getContext(id)).canDecide).toBe(
      true,
    );
    await requests.auth(bob.email).reject(id);
    expect((await requests.auth(bob.email).getRequest(id)).status).toBe(
      "rejected",
    );
  });

  test("scoped context works for enrolled grader and includes only actual thread authors", async () => {
    const id = await createAppeal("2");
    await requests
      .auth(carol.email)
      .comment(id, { text: "Checking the answer." });
    const context = await requests.auth(carol.email).getContext(id);
    expect(context).toEqual({
      courseTitle: course.title,
      assignedGrader: { email: carol.email, name: carol.name },
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
    const id = await createAppeal("1");
    await courses.auth(instructor.email).updateExams(clazz.course, {
      Midterm: { questions: { "1": { grader: carol.email } } },
    });
    expect(await requests.auth(bob.email).getRequestsAs(["grader"])).toEqual(
      [],
    );
    await expectFailure(
      requests.auth(bob.email).getRequest(id),
      ClassPermissionError,
    );
    expect((await requests.auth(carol.email).getRequest(id)).id).toBe(id);
  });

  test("ordinary thread lifecycle supports decision, review, redecision and cancellation", async () => {
    const id = await createAppeal("1");
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

  test("question assignment without grader enrollment grants no access and revocation is immediate", async () => {
    const id = await createAppeal("1");
    const opening = (await requests.auth(student.email).getRequest(id))
      .thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing proof");
    await users
      .auth(instructor.email)
      .deleteEnrollment(bob.email, { ...clazz, role: "grader" });
    const grader = requests.auth(bob.email);
    for (const operation of [
      () => grader.getRequest(id),
      () => grader.getRequestsByID([id]),
      () => grader.getContext(id),
      () => grader.fetchProof(opening.proofs?.[0]?.id as string),
      () => grader.comment(id, { text: "Revoked" }),
      () => grader.approve(id),
      () => grader.reject(id),
    ])
      await expectFailure(operation(), ClassPermissionError);
    expect(await grader.getRequestsAs(["grader"])).toEqual([]);
    expect(
      (await requests.auth(student.email).getContext(id)).assignedGrader,
    ).toBeNull();
    await expectFailure(createAppeal(), InvalidRequestError);
    expect(await conn.collections.requests.countDocuments()).toBe(1);
  });

  test("grader enrollment alone does not grant question access", async () => {
    const email = "unassigned-grader@ust.hk";
    await users
      .auth(instructor.email)
      .createEnrollment(email, { ...clazz, role: "grader" });
    const id = await createAppeal("1");
    const opening = (await requests.auth(student.email).getRequest(id))
      .thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing proof");
    const grader = requests.auth(email);
    for (const operation of [
      () => grader.getRequest(id),
      () => grader.getRequestsByID([id]),
      () => grader.getContext(id),
      () => grader.fetchProof(opening.proofs?.[0]?.id as string),
      () => grader.comment(id, { text: "Not assigned" }),
      () => grader.approve(id),
      () => grader.reject(id),
    ])
      await expectFailure(operation(), ClassPermissionError);
    expect(await grader.getRequestsAs(["grader"])).toEqual([]);
  });

  test("grader enrollment respects sections and wildcard without granting unrelated questions", async () => {
    const first = await createAppeal();
    await conn.collections.users.updateOne(
      { email: student.email },
      { $push: { enrollment: { ...clazz, section: "L2", role: "student" } } },
    );
    const secondInput = appeal();
    secondInput.request.class.section = "L2";
    const createSecond = () =>
      requests
        .auth(student.email)
        .createRequest(secondInput.request, secondInput.comment);
    await expectFailure(createSecond(), InvalidRequestError);
    await conn.collections.users.updateOne(
      { email: bob.email },
      { $set: { "enrollment.1.section": "*" } },
    );
    const second = await createSecond();
    expect(
      (await requests.auth(bob.email).getRequestsAs(["grader"]))
        .map((r) => r.id)
        .sort(),
    ).toEqual([first, second].sort());
    await conn.collections.users.updateOne(
      { email: bob.email },
      { $set: { "enrollment.1.section": "L1" } },
    );
    await expectFailure(
      requests.auth(bob.email).getRequest(second),
      ClassPermissionError,
    );
    expect(
      (await requests.auth(bob.email).getRequestsAs(["grader"])).map(
        (r) => r.id,
      ),
    ).toEqual([first]);
    expect(
      (await requests.auth(student.email).getContext(second)).assignedGrader,
    ).toBeNull();
  });

  test("student/grader inboxes stay separate and combined roles deduplicate requests", async () => {
    const received = await createAppeal();
    const own = await createAppeal("2", bob.email);
    const grader = requests.auth(bob.email);
    expect((await grader.getRequestsAs(["student"])).map((r) => r.id)).toEqual([
      own,
    ]);
    expect((await grader.getRequestsAs(["grader"])).map((r) => r.id)).toEqual([
      received,
    ]);
    await conn.collections.users.updateOne(
      { email: bob.email },
      { $push: { enrollment: { ...clazz, role: "instructor" } } },
    );
    const combined = await grader.getRequestsAs([
      "student",
      "grader",
      "instructor",
    ]);
    expect(combined).toHaveLength(2);
    expect(new Set(combined.map((r) => r.id))).toEqual(
      new Set([received, own]),
    );
  });

  test("assigned graders do not gain access to ordinary requests", async () => {
    await conn.collections.courses.updateOne(clazz.course, {
      $set: {
        "sections.L1.schedule": [{ day: 1, from: "09:00:00", to: "10:00:00" }],
      },
    });
    const examID = await createAppeal();
    const ordinaryID = await requests.auth(student.email).createRequest(
      {
        type: "Absent from Section",
        class: clazz,
        metadata: { fromSection: "L1", fromDate: "2026-10-12" },
      },
      { text: "Medical appointment", proofs: [proof] },
    );
    expect(
      (await requests.auth(bob.email).getRequestsAs(["grader"])).map(
        (r) => r.id,
      ),
    ).toEqual([examID]);
    const opening = (await requests.auth(student.email).getRequest(ordinaryID))
      .thread[0];
    if (opening?.kind !== "comment" || !opening.proofs?.[0])
      throw new Error("Missing proof");
    const grader = requests.auth(bob.email);
    for (const operation of [
      () => grader.getRequest(ordinaryID),
      () => grader.getRequestsByID([ordinaryID]),
      () => grader.getContext(ordinaryID),
      () => grader.fetchProof(opening.proofs?.[0]?.id as string),
      () => grader.comment(ordinaryID, { text: "Not grading" }),
      () => grader.approve(ordinaryID),
    ])
      await expectFailure(operation(), ClassPermissionError);
  });

  test("normal enrollment APIs create graders before login and grader rosters stay protected", async () => {
    const email = "new-grader@ust.hk";
    await users
      .auth(instructor.email)
      .createEnrollment(email, { ...clazz, role: "grader" });
    expect(
      (await users.auth(instructor.email).getUsersInClass(clazz, "grader")).map(
        (u) => u.email,
      ),
    ).toContain(email);
    expect((await users.auth(email).getCurrentUser()).enrollment).toEqual([
      { ...clazz, role: "grader" },
    ]);
    for (const role of ["student", "grader"] as const) {
      await expectFailure(
        users.auth(email).getUsersInClass(clazz, role),
        ClassPermissionError,
      );
      await expectFailure(
        users.auth(student.email).getUsersInClass(clazz, role),
        ClassPermissionError,
      );
    }
    await courses.auth(instructor.email).updateExams(clazz.course, {
      Midterm: { questions: { "1": { grader: email } } },
    });
    expect(await requests.auth(email).getRequestsAs(["grader"])).toEqual([]);
  });

  test("rejects missing exam/question, unenrolled class, disabled type and missing student enrollment before saving", async () => {
    const valid = appeal();
    const invalidRequests: RequestInit[] = [
      { ...valid.request, metadata: { examCode: "Final", question: "1" } },
      appeal("999").request,
      {
        ...valid.request,
        metadata: { examCode: "constructor", question: "1" },
      },
    ];
    for (const input of invalidRequests)
      await expectFailure(
        requests.auth(student.email).createRequest(input, valid.comment),
        InvalidRequestError,
      );
    await expectFailure(
      requests
        .auth(student.email)
        .createRequest(
          { ...valid.request, class: { ...clazz, section: "NOPE" } },
          valid.comment,
        ),
      ClassPermissionError,
    );
    await conn.collections.courses.updateOne(clazz.course, {
      $set: { "effectiveRequestTypes.Exam Appeal": false },
    });
    await expectFailure(createAppeal(), RequestTypeNotEffectiveError);
    await expectFailure(createAppeal("1", carol.email), ClassPermissionError);
    expect(await conn.collections.requests.countDocuments()).toBe(0);
    expect(await conn.collections.proofs.find({}).toArray()).toEqual([]);
  });

  test("rejects forged grader and multiple-question metadata before saving", async () => {
    const valid = appeal();
    for (const metadata of [
      { examCode: "Midterm", question: "1", grader: bob.email },
      { examCode: "Midterm", questions: ["1", "2"] },
      { examCode: "Midterm", question: ["1", "2"] },
      { examCode: "Midterm", question: "1", reason: "Old ticket metadata" },
    ])
      await expectFailure(
        requests
          .auth(student.email)
          .createRequest(
            { ...valid.request, metadata } as unknown as RequestInit,
            valid.comment,
          ),
      );
    expect(await conn.collections.requests.countDocuments()).toBe(0);
    expect(await conn.collections.proofs.find({}).toArray()).toEqual([]);
  });

  test("server validates grader addresses and question identifiers before updating", async () => {
    const invalidExams: Course["exams"][] = [
      { Midterm: { questions: { "1": { grader: "invalid" } } } },
      { Midterm: { questions: { " ": { grader: bob.email } } } },
      { Midterm: { questions: { "1": { grader: "unknown@ust.hk" } } } },
      { Midterm: { questions: { "1": { grader: student.email } } } },
    ];
    for (const exams of invalidExams)
      await expectFailure(
        courses.auth(instructor.email).updateExams(clazz.course, exams),
      );
    await expectFailure(
      courses.auth(student.email).updateExams(clazz.course, course.exams),
    );
    expect(
      (await courses.auth(instructor.email).getCourse(clazz.course)).exams,
    ).toEqual(course.exams);
    await conn.collections.courses.updateOne(clazz.course, {
      $set: { "exams.Midterm.questions.1.grader": "invalid" },
    });
    await expectFailure(createAppeal());
    expect(await conn.collections.requests.countDocuments()).toBe(0);
  });
});
