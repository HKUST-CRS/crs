/**
 * Dev-only seed script: stand up a local environment with test data.
 *
 * 1) create or reset a CRS test course (TEST 0000)
 * 2) create or reset a dev user with a fixed enrollment
 *
 * Usage (from the repo root):
 *   bun run --filter=server seed        # seeds the default dev user (god@ust.hk)
 *   bun run --filter=server seed <email> # seeds a specific user
 *
 * - The course is always (re)applied, so the local DB matches the project fixture.
 * - The user defaults to god@ust.hk, a sudoer that can administer
 *   courses and act as student/instructor. Pass any other email to seed a regular
 *   student+instructor tester for that account.
 *
 * Connects via the same MONGO_URI the server uses (packages/server/.env), so the
 * dev database must be running first (`docker start mongodb-crs`).
 *
 * NOTE: Development convenience only
 */

import { DbConn } from "service/db";
import {
  type Course,
  type Enrollment,
  Enrollments,
  type UserID,
} from "service/models";

const DEFAULT_EMAIL: UserID = "god@ust.hk";
const DEV_COURSE = { code: "TEST 0000", term: "0010" } as const;

const TEST_COURSE: Course = {
  code: DEV_COURSE.code,
  term: DEV_COURSE.term,
  title: "Introduction to CRS Development",
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
  },
  sections: {
    LA1: {
      schedule: [
        { day: 6, from: "00:00", to: "23:59" },
        { day: 7, from: "00:00", to: "23:59" },
      ],
    },
    LA2: {
      schedule: [{ day: 1, from: "00:00", to: "23:59" }],
    },
    LA3: {
      schedule: [{ day: 1, from: "09:00", to: "10:20" }],
    },
    LA4: {
      schedule: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
        day,
        from: "00:00",
        to: "23:59",
      })),
    },
  },
  assignments: {
    "111": {
      name: "222",
      due: "2026-03-03T23:59:59.999+08:00",
      maxExtension: "PT13219200S",
    },
    aaa: {
      name: "aaa",
      due: "2026-05-28T00:00:59.999+08:00",
      maxExtension: "PT15465600S",
    },
    PA1: {
      name: "CRS Development",
      due: "2026-05-01T23:59:59.999+08:00",
      maxExtension: "PT2592000S",
    },
    PA2: {
      name: "test",
      due: "2026-03-31T23:59:59.999+08:00",
      maxExtension: "PT5788800S",
    },
  },
};

const DEV_ENROLLMENT: Enrollment[] = [
  { course: { ...DEV_COURSE }, section: "LA1", role: "student" },
  { course: { ...DEV_COURSE }, section: "LA1", role: "instructor" },
];
DEV_ENROLLMENT.sort(Enrollments.compare);

async function seedCourse(conn: DbConn): Promise<void> {
  await conn.collections.courses.replaceOne(
    { code: TEST_COURSE.code, term: TEST_COURSE.term },
    TEST_COURSE,
    { upsert: true },
  );
  console.log(`✓ Course ${TEST_COURSE.code} ${TEST_COURSE.term} ready`);
}

/** Create or reset a dev user with the fixed enrollment (idempotent). */
async function seedUser(conn: DbConn, email: UserID): Promise<void> {
  // god@ust.hk is a sudoer ("god mode"); other seeded users are not.
  const sudoer = email === DEFAULT_EMAIL;
  const result = await conn.collections.users.updateOne(
    { email },
    {
      // Only set the name on insert; preserve the name from a real login.
      $setOnInsert: { name: "" },
      $set: { enrollment: DEV_ENROLLMENT, sudoer },
    },
    { upsert: true },
  );

  const user = await conn.collections.users.findOne({ email });
  console.log(
    `Seeded ${email} (sudoer: ${sudoer}, ${result.upsertedId ? "created" : "updated"})`,
  );
  console.log(JSON.stringify(user, null, 2));
}

async function main(): Promise<void> {
  // Hard stop in production: seeding creates/resets a sudoer and a test
  // course and force-overwrites the target user's enrollment. This is dev-only
  // tooling — never run it against a real database.
  if (Bun.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed: NODE_ENV is 'production'. The seed script is dev-only and destructively overwrites users.",
    );
  }
  const email = (Bun.argv[2] ?? DEFAULT_EMAIL) as UserID;
  const conn = await DbConn.createFromEnv();
  try {
    await seedCourse(conn);
    await seedUser(conn, email);
  } finally {
    await conn.close();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
