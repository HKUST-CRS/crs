import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ZodError } from "zod";
import { DbConn } from "../db";
import { CommentInit, Course, RequestInit, User } from "../models";
import { createRepos } from "../repos";
import { UserService } from "../services";

const course = Course.parse({
  code: "TEST 1000",
  term: "2610",
  title: "Strict schemas",
  sections: {
    L1: { schedule: [{ day: 1, from: "09:00:00", to: "10:00:00" }] },
  },
  assignments: {},
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
  },
});
const courseID = { code: course.code, term: course.term };
const clazz = { course: courseID, section: "L1" };
const studentEnrollment = { ...clazz, role: "student" as const };
const user: User = {
  email: "student@connect.ust.hk",
  name: "Student",
  enrollment: [studentEnrollment],
  sudoer: false,
};
const request: RequestInit = {
  type: "Absent from Section",
  class: clazz,
  metadata: { fromSection: "L1", fromDate: "2026-10-14" },
};

async function expectSchemaFailure(promise: Promise<unknown>) {
  // Bun's pending-promise .rejects matcher blocks MongoDB I/O in this version.
  const error = await promise.catch((error: unknown) => error);
  expect(error).toBeInstanceOf(ZodError);
}

let mongo: MongoMemoryReplSet;
let conn: DbConn;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  conn = await DbConn.create(mongo.getUri());
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    conn.collections.courses.deleteMany({}),
    conn.collections.users.deleteMany({}),
    conn.collections.requests.deleteMany({}),
  ]);
  await conn.collections.courses.insertOne(structuredClone(course));
  await conn.collections.users.insertOne(structuredClone(user));
});
afterAll(async () => {
  await conn?.close();
  await mongo?.stop();
});

test("MongoDB course and user reads still satisfy strict API output schemas", async () => {
  expect(await conn.collections.courses.findOne(courseID)).toHaveProperty(
    "_id",
  );
  expect(
    await conn.collections.users.findOne({ email: user.email }),
  ).toHaveProperty("_id");
  const repos = createRepos(conn.collections);
  const [
    oneCourse,
    allCourses,
    enrolledCourses,
    oneUser,
    courseUsers,
    classUsers,
    classes,
  ] = await Promise.all([
    repos.course.requireCourse(courseID),
    repos.course.getCourses(),
    repos.course.getCoursesFromEnrollment(user, ["student"]),
    repos.user.requireUser(user.email),
    repos.user.getUsersInCourse(courseID),
    repos.user.getUsersInClass(clazz, "student"),
    repos.user.getClasses(courseID),
  ]);
  for (const result of [oneCourse, ...allCourses, ...enrolledCourses]) {
    expect(Course.parse(result)).toEqual(course);
  }
  for (const result of [oneUser, ...courseUsers, ...classUsers]) {
    expect(User.parse(result)).toEqual(user);
  }
  expect(classes).toEqual([clazz]);
  expect(await repos.user.getUser("missing@ust.hk")).toBeNull();
});

test("one invalid stored course rejects each affected course read", async () => {
  const repos = createRepos(conn.collections);
  const otherCourse = { ...course, code: "TEST 1001" };
  await conn.collections.courses.insertOne(structuredClone(otherCourse));
  const enrolledUser: User = {
    ...user,
    enrollment: [
      ...user.enrollment,
      {
        course: { code: otherCourse.code, term: otherCourse.term },
        section: "L1",
        role: "student",
      },
    ],
  };
  await conn.collections.courses.updateOne(courseID, {
    $set: { unexpected: true },
  });
  await expectSchemaFailure(repos.course.requireCourse(courseID));
  await expectSchemaFailure(repos.course.getCourses());
  await expectSchemaFailure(
    repos.course.getCoursesFromEnrollment(enrolledUser, ["student"]),
  );
  expect(
    await repos.course.requireCourse({
      code: otherCourse.code,
      term: otherCourse.term,
    }),
  ).toEqual(otherCourse);
});

for (const field of ["unexpected", "enrollment.0.course.unexpected"]) {
  test(`stored user field ${field} rejects user and class reads without hiding other users`, async () => {
    const repos = createRepos(conn.collections);
    const otherUser: User = { ...user, email: "other@connect.ust.hk" };
    await conn.collections.users.insertOne(structuredClone(otherUser));
    await conn.collections.users.updateOne(
      { email: user.email },
      { $set: { [field]: true } },
    );
    await expectSchemaFailure(repos.user.getUser(user.email));
    await expectSchemaFailure(repos.user.requireUser(user.email));
    await expectSchemaFailure(repos.user.getUsersInCourse(courseID));
    await expectSchemaFailure(repos.user.getUsersInClass(clazz, "student"));
    await expectSchemaFailure(repos.user.getClasses(courseID));
    expect(await repos.user.requireUser(otherUser.email)).toEqual(otherUser);
  });
}

for (const [field, value] of [
  ["unexpected", true],
  ["status", "approved"],
] as const) {
  test(`stored request field ${field} rejects each matching request list`, async () => {
    const repos = createRepos(conn.collections);
    const id = await repos.request.createRequest(user.email, request, {
      text: "Reason",
      proofs: [],
    });
    const otherID = await repos.request.createRequest(user.email, request, {
      text: "Another reason",
      proofs: [],
    });
    await conn.collections.requests.updateOne(
      { id },
      { $set: { [field]: value } },
    );
    await expectSchemaFailure(repos.request.requireRequest(id));
    await expectSchemaFailure(repos.request.getRequestsFromUser(user.email));
    await expectSchemaFailure(repos.request.getRequestsInClasses([clazz]));
    await expectSchemaFailure(repos.request.getRequestsByID([otherID, id]));
    expect((await repos.request.requireRequest(otherID)).id).toBe(otherID);
  });
}

test("valid enrollment transactions read strict users without MongoDB metadata", async () => {
  const repos = createRepos(conn.collections);
  const enrollment = { ...clazz, role: "observer" as const };
  await repos.user.createEnrollment(user.email, enrollment);
  expect((await repos.user.requireUser(user.email)).enrollment).toContainEqual(
    enrollment,
  );
  await repos.user.deleteEnrollment(user.email, enrollment);
  expect(await repos.user.requireUser(user.email)).toEqual(user);
});

for (const [field, value] of [
  ["unexpected", true],
  ["name", 42],
] as const) {
  test(`authentication sync preserves invalid stored user field ${field}`, async () => {
    await conn.collections.users.updateOne(
      { email: user.email },
      { $set: { [field]: value } },
    );
    const before = await conn.collections.users.findOne({ email: user.email });
    const service = new UserService(createRepos(conn.collections));
    expect(
      await service
        .auth(user.email)
        .sync("Updated provider name")
        .catch((error: unknown) => error),
    ).toBeInstanceOf(ZodError);
    expect(await conn.collections.users.findOne({ email: user.email })).toEqual(
      before,
    );
  });
}

test("createEnrollment rolls back an invalid newly added enrollment", async () => {
  const repos = createRepos(conn.collections);
  const before = await conn.collections.users.findOne({ email: user.email });
  const enrollment = { ...clazz, role: "observer" as const, unexpected: true };
  await expectSchemaFailure(
    repos.user.createEnrollment(user.email, enrollment),
  );
  expect(await conn.collections.users.findOne({ email: user.email })).toEqual(
    before,
  );
});

for (const operation of ["createEnrollment", "deleteEnrollment"] as const) {
  for (const field of ["unexpected", "enrollment.0.unexpected"]) {
    test(`${operation} leaves invalid stored field ${field} unchanged`, async () => {
      const repos = createRepos(conn.collections);
      await conn.collections.users.updateOne(
        { email: user.email },
        { $set: { [field]: true } },
      );
      const before = await conn.collections.users.findOne({
        email: user.email,
      });
      const enrollment =
        operation === "createEnrollment"
          ? { ...clazz, role: "observer" as const }
          : studentEnrollment;
      await expectSchemaFailure(repos.user[operation](user.email, enrollment));
      expect(
        await conn.collections.users.findOne({ email: user.email }),
      ).toEqual(before);
    });
  }
}

test("request inputs reject injected server fields and unknown nested metadata", () => {
  expect(RequestInit.parse(request)).toEqual(request);
  expect(
    RequestInit.safeParse({ ...request, from: "other@ust.hk" }).success,
  ).toBe(false);
  expect(
    RequestInit.safeParse({
      ...request,
      metadata: { ...request.metadata, unrecognized: "ignored before" },
    }).success,
  ).toBe(false);
  expect(
    CommentInit.safeParse({
      text: "Reason",
      proofs: [{ name: "proof.txt", size: 1, content: "YQ==", id: "forged" }],
    }).success,
  ).toBe(false);
});

test("course inputs reject unknown fields within a nested schedule", () => {
  expect(
    Course.safeParse({
      ...course,
      sections: {
        L1: {
          schedule: [{ day: 1, from: "09:00:00", to: "10:00:00", extra: true }],
        },
      },
    }).success,
  ).toBe(false);
});
