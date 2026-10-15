import type { DbConn } from "../db";
import type { Course, RequestDocument, User } from "../models";

export type TestFixtures = {
  users?: User[];
  courses?: Course[];
  requests?: RequestDocument[];
};

export async function insertData(conn: DbConn, fixtures: TestFixtures) {
  const { users = [], courses = [], requests = [] } = fixtures;
  await Promise.all([
    users.length > 0
      ? conn.collections.users.insertMany(structuredClone(users))
      : undefined,
    courses.length > 0
      ? conn.collections.courses.insertMany(structuredClone(courses))
      : undefined,
    requests.length > 0
      ? conn.collections.requests.insertMany(structuredClone(requests))
      : undefined,
  ]);
}

export async function clearData(conn: DbConn) {
  await Promise.all([
    conn.collections.users.deleteMany({}),
    conn.collections.courses.deleteMany({}),
    conn.collections.requests.deleteMany({}),
    conn.collections.proofs.drop(),
  ]);
}
