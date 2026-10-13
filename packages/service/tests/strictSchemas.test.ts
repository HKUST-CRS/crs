import { afterAll, beforeAll, expect, test } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ZodError } from "zod";
import { DbConn } from "../db";
import { CommentInit, Course, RequestInit, User } from "../models";
import { createRepos } from "../repos";

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
const user: User = {
  email: "student@connect.ust.hk",
  name: "Student",
  enrollment: [{ ...clazz, role: "student" }],
  sudoer: false,
};
const request: RequestInit = {
  type: "Absent from Section",
  class: clazz,
  metadata: { fromSection: "L1", fromDate: "2026-10-14" },
};

let mongo: MongoMemoryServer;
let conn: DbConn;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  conn = await DbConn.create(mongo.getUri());
  await conn.collections.courses.insertOne(structuredClone(course));
  await conn.collections.users.insertOne(structuredClone(user));
}, 120_000);
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
  ] = await Promise.all([
    repos.course.requireCourse(courseID),
    repos.course.getCourses(),
    repos.course.getCoursesFromEnrollment(user, ["student"]),
    repos.user.requireUser(user.email),
    repos.user.getUsersInCourse(courseID),
    repos.user.getUsersInClass(clazz, "student"),
  ]);
  for (const result of [oneCourse, ...allCourses, ...enrolledCourses]) {
    expect(Course.parse(result)).toEqual(course);
  }
  for (const result of [oneUser, ...courseUsers, ...classUsers]) {
    expect(User.parse(result)).toEqual(user);
  }
  await conn.collections.courses.updateOne(courseID, {
    $set: { unexpected: true },
  });
  const invalidStoredCourse = await repos.course
    .requireCourse(courseID)
    .catch((error: unknown) => error);
  expect(invalidStoredCourse).toBeInstanceOf(ZodError);
});

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
