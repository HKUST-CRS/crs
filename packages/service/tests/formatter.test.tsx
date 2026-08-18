import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Request, User } from "../models";
import { formatRequest } from "../templates/Formatter";

const student: User = {
  email: "student@connect.ust.hk",
  name: "Student",
  enrollment: [],
  sudoer: false,
};

test("request summaries do not claim opening proofs are email attachments", () => {
  const request: Request = {
    id: "request-id",
    from: student.email,
    class: {
      course: { code: "COMP 1023", term: "2510" },
      section: "L1",
    },
    type: "Swap Section",
    metadata: {
      fromSection: "L1",
      fromDate: "2025-11-25",
      toSection: "L2",
      toDate: "2025-11-26",
    },
    timestamp: "2025-11-20T09:00:00+08:00",
    status: "open",
    thread: [
      {
        id: "opening-comment",
        from: student.email,
        timestamp: "2025-11-20T09:00:00+08:00",
        kind: "comment",
        text: "I need to swap.",
        proofs: [
          {
            name: "proof.txt",
            size: 2,
            hash: "0".repeat(64),
            id: "proof-file-1",
          },
        ],
      },
    ],
  };

  const summary = renderToStaticMarkup(
    formatRequest(request, { student, instructors: [], observers: [] }),
  );

  expect(summary).toContain(
    "The student provided 1 proof document(s) with the request.",
  );
  expect(summary).not.toContain("for the request attached");
});
