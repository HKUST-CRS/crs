/**
 * Dev-only: seed realistic request-thread data for manual verification.
 *
 * Seeds two accounts in TEST 0000 and drives the real RequestService to create
 * one request per lifecycle state, each with a multi-entry thread:
 *   - OPEN       (student ↔ instructor discussion, undecided)
 *   - APPROVED   (instructor approves with a remark)
 *   - REJECTED   (instructor rejects with a remark)
 *   - APPEALED   (rejected, then the student appeals)
 *   - CANCELLED  (approved, then the student cancels)
 *
 * Idempotent: clears all requests before (re)creating. Dev-only — refuses to
 * run under NODE_ENV=production.
 *
 *   cd packages/server && bun run scripts/seed-data.ts
 */
import { DbConn } from "service/db";
import type { ProofUpload, RequestInit, User } from "service/models";
import { createRepos } from "service/repos";
import { RequestService } from "service/services";

const COURSE = { code: "TEST 0000", term: "0010" };
const STUDENT = "dpshah@connect.ust.hk";
const INSTRUCTOR = "prof@ust.hk";

const users: User[] = [
  {
    email: STUDENT,
    name: "Dhruv Shah",
    enrollment: [
      { course: { ...COURSE }, section: "LA1", role: "student" },
      { course: { ...COURSE }, section: "LA1", role: "instructor" },
    ],
    sudoer: false,
  },
  {
    email: INSTRUCTOR,
    name: "Prof. Verifier",
    enrollment: [{ course: { ...COURSE }, section: "LA1", role: "instructor" }],
    sudoer: false,
  },
];

const note: ProofUpload = [
  {
    name: "medical-cert.txt",
    size: 5,
    content: Buffer.from("note").toString("base64"),
  },
];

function class_(section: string) {
  return { course: { ...COURSE }, section };
}

function swap(
  reason: string,
  to: string,
  proof: ProofUpload = [],
): RequestInit {
  return {
    type: "Swap Section",
    class: class_("LA1"),
    details: { reason, proof },
    metadata: {
      fromSection: "LA1",
      fromDate: "2026-03-16",
      toSection: to,
      toDate: "2026-03-17",
    },
  };
}

function absent(reason: string): RequestInit {
  return {
    type: "Absent from Section",
    class: class_("LA1"),
    details: { reason, proof: [] },
    metadata: { fromSection: "LA1", fromDate: "2026-03-15" },
  };
}

function deadline(
  reason: string,
  assignment: string,
  proof: ProofUpload = [],
): RequestInit {
  return {
    type: "Deadline Extension",
    class: class_("LA1"),
    details: { reason, proof },
    metadata: {
      assignment,
      deadline: "2026-05-03T23:59:59.999+08:00",
    },
  };
}

async function main() {
  if (Bun.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed data: NODE_ENV is 'production' (dev-only).",
    );
  }
  const conn = await DbConn.createFromEnv();
  try {
    const svc = new RequestService(createRepos(conn.collections));
    for (const u of users) {
      await conn.collections.users.updateOne(
        { email: u.email },
        { $set: u },
        { upsert: true },
      );
    }
    await conn.collections.requests.deleteMany({});
    console.log("✓ Seeded users; cleared requests.\n");

    const student = () => svc.auth(STUDENT);
    const prof = () => svc.auth(INSTRUCTOR);

    // R1 — OPEN: a back-and-forth that is still undecided.
    const r1 = await student().createRequest(
      swap(
        "I'd like to swap into LA2 for the week of Mar 16 to join my project group.",
        "LA2",
      ),
    );
    await student().addComment(r1, {
      text: "Monday's LA1 clashes with my capstone defense.",
    });
    await prof().addComment(r1, {
      text: "Could you confirm the exact lecture date you'd miss?",
    });

    // R2 — APPROVED: instructor approves with a remark.
    const r2 = await student().createRequest(
      deadline(
        "Requesting a 2-day extension on PA1 due to illness.",
        "PA1",
        note,
      ),
    );
    await prof().approve(r2, {
      text: "Granted — please submit by the new deadline.",
    });

    // R3 — REJECTED: instructor rejects, asking for more evidence.
    const r3 = await student().createRequest(
      absent("I'll be away at a conference on Mar 15."),
    );
    await prof().reject(r3, {
      text: "Please attach the conference invitation as proof.",
    });

    // R4 — APPEALED: rejected, then the student appeals.
    const r4 = await student().createRequest(
      swap("LA3 fits my timetable better this term.", "LA3"),
    );
    await prof().reject(r4, { text: "LA3 is currently full." });
    await student().appeal(r4, {
      text: "A peer has agreed to swap out of LA3 — could you reconsider?",
    });

    // R5 — CANCELLED: approved, then the student withdraws.
    const r5 = await student().createRequest(
      deadline("May I extend the PA2 deadline by a day?", "PA2"),
    );
    await prof().approve(r5, { text: "Provisionally approved." });
    await student().cancel(r5, {
      text: "Withdrawing — I'll submit on time after all.",
    });

    console.log("✓ Created lifecycle requests:");
    for (const id of [r1, r2, r3, r4, r5]) {
      const r = await student().getRequest(id);
      console.log(
        `  ${r.status.padEnd(9)}  ${r.type.padEnd(20)} entries=${r.updates.length}  id=${id}`,
      );
    }
  } finally {
    await conn.close();
  }
}

main().catch((error) => {
  console.error("Seed-data failed:", error);
  process.exit(1);
});
