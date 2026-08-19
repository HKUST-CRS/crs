/**
 * Dev-only seed script: stand up a local environment with test data.
 *
 * 1) create or reset a CRS test course (TEST 0000)
 * 2) create or reset a dev user with a fixed enrollment
 *
 * Usage examples (from the repo root):
 *
 *   # seeds a regular user
 *   bun run --filter=server seed <email>
 *
 *   # seeds a sudo user with an initial name
 *   bun run --filter=server seed <email> [name] --sudo
 *
 *   # resets the database before seeding
 *   bun run --filter=server seed <email> --clean
 *
 * - The course is always (re)applied, so the local DB matches the
 *   project fixture.
 * - The email is required. The initial name is optional and is only used when
 *   creating a new user. Use --sudo to grant sudo privileges and --clean to
 *   reset the database first.
 *
 * Connects via the same MONGO_URI the server uses
 * (packages/server/.env), so the dev database must be running first
 * (`docker compose up`).
 */

import { DbConn } from "service/db";
import {
  type Course,
  type Enrollment,
  Enrollments,
  type UserID,
} from "service/models";

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
    PA1: {
      name: "CRS Development",
      due: "2026-05-01T23:59:59.999+08:00",
      maxExtension: "PT2592000S",
    },
    PA2: {
      name: "Further CRS Development",
      due: "2026-09-01T23:59:59.999+08:00",
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
async function seedUser(
  conn: DbConn,
  email: UserID,
  initialName: string,
  sudoer: boolean,
): Promise<void> {
  const result = await conn.collections.users.updateOne(
    { email },
    {
      // Only set the name on insert; preserve the name from a real login.
      $setOnInsert: { name: initialName },
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

function parseArgs(args: string[]): {
  email: UserID;
  initialName: string;
  sudoer: boolean;
  clean: boolean;
} {
  const flags = args.filter((arg) => arg.startsWith("--"));
  const positional = args.filter((arg) => !arg.startsWith("--"));
  if (
    !positional[0] ||
    positional.length > 2 ||
    flags.some((flag) => flag !== "--sudo" && flag !== "--clean")
  ) {
    throw new Error(
      "Usage: bun run --filter=server seed <email> [name] [--sudo] [--clean]",
    );
  }

  return {
    email: positional[0] as UserID,
    initialName: positional[1] ?? "",
    sudoer: flags.includes("--sudo"),
    clean: flags.includes("--clean"),
  };
}

async function main(): Promise<void> {
  // Hard stop in production: seeding creates/resets a user and a test course
  // and force-overwrites the target user's enrollment. This is dev-only
  // tooling — never run it against a real database.
  if (Bun.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed: NODE_ENV is 'production'. The seed script is dev-only and destructively overwrites users.",
    );
  }
  const { email, initialName, sudoer, clean } = parseArgs(Bun.argv.slice(2));
  const conn = await DbConn.createFromEnv();
  try {
    if (clean) {
      await conn.dropDatabase();
      console.log("✓ Database reset");
    }
    await seedCourse(conn);
    await seedUser(conn, email, initialName, sudoer);
  } finally {
    await conn.close();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
