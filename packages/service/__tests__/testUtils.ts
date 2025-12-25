import type { DbConn } from "../db";
import { courses, instructors, students, tas } from "./testData";

export async function insertTestData(conn: DbConn) {
  await conn.collections.users.insertMany([
    ...students,
    ...tas,
    ...instructors,
  ]);
  await conn.collections.courses.insertMany(courses);
}

export async function clearData(conn: DbConn) {
  await Promise.all([
    conn.collections.users.deleteMany({}),
    conn.collections.courses.deleteMany({}),
    conn.collections.requests.deleteMany({}),
  ]);
}
