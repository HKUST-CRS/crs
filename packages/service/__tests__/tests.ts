import type { DbConn } from "../db";
import type { Course, Request, User } from "../models";

export type TestFixtures = {
  users?: User[];
  courses?: Course[];
  requests?: Request[];
};

export async function insertData(conn: DbConn, fixtures: TestFixtures) {
  const { users = [], courses = [], requests = [] } = fixtures;
  await Promise.all([
    users.length > 0 ? conn.collections.users.insertMany(users) : undefined,
    courses.length > 0
      ? conn.collections.courses.insertMany(courses)
      : undefined,
    requests.length > 0
      ? conn.collections.requests.insertMany(requests)
      : undefined,
  ]);
}

export async function clearData(conn: DbConn) {
  await Promise.all([
    conn.collections.users.deleteMany({}),
    conn.collections.courses.deleteMany({}),
    conn.collections.requests.deleteMany({}),
  ]);
}
