import { expect, mock, spyOn, test } from "bun:test";
import nodemailer, { type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import {
  Classes,
  Course,
  Request,
  type ThreadEntry,
  type User,
} from "../models";
import { Signature } from "../models/request/Signature";
import type { Repos } from "../repos";
import { NotificationService } from "../services/ServiceNotification";
import { formatDate, formatDateTime } from "../utils/datetime";

const clazz = { course: { code: "COMP 1023", term: "2610" }, section: "L1" };
const student: User = {
  email: "student@connect.ust.hk",
  name: "Student",
  sudoer: false,
  enrollment: [{ ...clazz, role: "student" }],
};
const instructor: User = {
  email: "instructor@ust.hk",
  name: "Instructor",
  sudoer: false,
  enrollment: [
    { ...clazz, role: "instructor" },
    { ...clazz, role: "grader" },
  ],
};
const observer: User = {
  email: "observer@ust.hk",
  name: "Observer",
  sudoer: false,
  enrollment: [{ ...clazz, role: "observer" }],
};
const course = Course.parse({
  ...clazz.course,
  title: "Programming",
  sections: { L1: { schedule: [] } },
  assignments: {},
  exams: {
    Midterm: { questions: { Q1: { grader: instructor.email } } },
    Final: { questions: {} },
  },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Exam Appeal": true,
    "Exam Special Arrangement": true,
  },
});
const timestamp = "2026-10-14T10:00:00+08:00";
const base = {
  id: "notification-request",
  from: student.email,
  class: clazz,
  timestamp,
  status: "open",
  thread: [
    {
      id: "opening",
      from: student.email,
      timestamp,
      kind: "comment",
      text: "Please review my supporting explanation.",
    },
  ],
};
const cases = [
  {
    request: Request.parse({
      ...base,
      type: "Swap Section",
      metadata: {
        fromSection: "L1",
        fromDate: "2026-11-25",
        toSection: "L2",
        toDate: "2026-11-26",
      },
    }),
    suffix: "",
    details: `The student is requesting to swap from section L1 on ${formatDate("2026-11-25")} to section L2 on ${formatDate("2026-11-26")}.`,
  },
  {
    request: Request.parse({
      ...base,
      type: "Absent from Section",
      metadata: { fromSection: "L1", fromDate: "2026-11-25" },
    }),
    suffix: "",
    details: `The student is requesting to be absent from section L1 on ${formatDate("2026-11-25")}.`,
  },
  {
    request: Request.parse({
      ...base,
      type: "Deadline Extension",
      metadata: { assignment: "PA1", deadline: "2026-11-25T10:00:00+08:00" },
    }),
    suffix: "",
    details: `The student is requesting a deadline extension for assignment PA1 to ${formatDateTime("2026-11-25T10:00:00+08:00")}.`,
  },
  {
    request: Request.parse({
      ...base,
      type: "Exam Appeal",
      metadata: { examCode: "Midterm", question: "Q1" },
    }),
    suffix: " (Midterm Q1)",
    details:
      "The student is requesting a grade review of exam Midterm, question Q1.",
  },
  {
    request: Request.parse({
      ...base,
      type: "Exam Special Arrangement",
      metadata: { examCode: "Final" },
    }),
    suffix: " (Final)",
    details: "The student is requesting a special arrangement for exam Final.",
  },
];

async function captureNotifications(
  staff: User[],
  run: (
    notifications: NotificationService,
    sent: Mail.Options[],
  ) => Promise<void>,
) {
  const requester =
    staff.find((user) => user.email === student.email) ?? student;
  const profiles = new Map(
    [requester, ...staff, observer].map((user) => [user.email, user]),
  );
  const repos = {
    user: {
      requireUser: async (email: string) => {
        const user = profiles.get(email);
        if (!user) throw new Error(`Unknown test recipient ${email}`);
        return user;
      },
      getUser: async (email: string) => profiles.get(email) ?? null,
      getUsersInClass: async (_class: unknown, role: string) =>
        role === "instructor" ? [...staff] : [observer],
    },
    course: { requireCourse: async () => course },
  } as unknown as Repos;
  const sent: Mail.Options[] = [];
  const transport = spyOn(nodemailer, "createTransport").mockReturnValue({
    sendMail: mock(async (mail: Mail.Options) => {
      sent.push(mail);
      return {};
    }),
  } as unknown as Transporter);
  const signature = spyOn(Signature, "sign").mockResolvedValue(
    "test-signature",
  );
  const keys = ["SMTP_HOST", "SMTP_PORT", "EMAIL_FROM", "BASE_URL"] as const;
  const previous = keys.map((key) => Bun.env[key]);
  Object.assign(Bun.env, {
    SMTP_HOST: "smtp.invalid",
    SMTP_PORT: "465",
    EMAIL_FROM: "test@ust.hk",
    BASE_URL: "https://crs.test",
  });
  try {
    await run(new NotificationService(repos), sent);
  } finally {
    transport.mockRestore();
    signature.mockRestore();
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete Bun.env[key];
      else Bun.env[key] = previous[index];
    });
  }
}

for (const { request, suffix, details } of cases) {
  test(`${request.type} keeps its notification details, subject and staff/student recipients`, async () => {
    await captureNotifications([instructor], async (notifications, sent) => {
      await notifications.notifyRequestUpdate(request);
      expect(sent[0]?.subject).toBe(
        `Request - ${Classes.format(clazz)}${suffix}`,
      );
      expect(sent[0]?.html).toContain(details);
      expect(sent[0]?.html).toContain(base.thread[0]?.text ?? "");
      expect(sent[0]?.to).toEqual([instructor.email]);
      expect(sent[0]?.cc).toEqual([student.email, observer.email]);
      expect(sent[0]?.html).toContain("Dear Instructor,");

      const entries: ThreadEntry[] = [
        {
          id: "decision-comment",
          from: instructor.email,
          timestamp,
          kind: "comment",
          text: "Reviewed and approved.",
        },
        {
          id: "decision",
          from: instructor.email,
          timestamp,
          kind: "status",
          status: "approved",
        },
      ];
      await notifications.notifyRequestUpdate(
        {
          ...request,
          status: "approved",
          thread: [...request.thread, ...entries],
        },
        entries,
      );
      expect(sent[1]?.subject).toBe(
        `Approved - ${Classes.format(clazz)}${suffix}`,
      );
      expect(sent[1]?.html).toContain(details);
      expect(sent[1]?.html).toContain("Reviewed and approved.");
      expect(sent[1]?.to).toEqual([student.email]);
      expect(sent[1]?.cc).toEqual([instructor.email, observer.email]);
      expect(sent[1]?.html).toContain("Dear Student,");
      expect(sent).toHaveLength(2);
    });
  });
}

const ownInstructor: User = {
  ...student,
  enrollment: [...student.enrollment, { ...clazz, role: "instructor" }],
};
const ownRequest = cases[4]?.request as Request;
for (const status of ["approved", "rejected"] as const) {
  test(`a requester/instructor's own ${status} decision notifies them as the requester without duplicate CC`, async () => {
    await captureNotifications(
      [ownInstructor, instructor],
      async (notifications, sent) => {
        const entries: ThreadEntry[] = [
          {
            id: "own-comment",
            from: student.email,
            timestamp,
            kind: "comment",
            text: "Recorded my decision.",
          },
          {
            id: "own-decision",
            from: student.email,
            timestamp,
            kind: "status",
            status,
          },
        ];
        await notifications.notifyRequestUpdate(
          { ...ownRequest, status, thread: [...ownRequest.thread, ...entries] },
          entries,
        );
        expect(sent[0]?.to).toEqual([student.email]);
        expect(sent[0]?.cc).toEqual([instructor.email, observer.email]);
        expect(sent[0]?.subject).toBe(
          `${status === "approved" ? "Approved" : "Rejected"} - ${Classes.format(clazz)} (Final)`,
        );
        expect(sent[0]?.html).toContain("Dear Student,");
      },
    );
  });
}

test("a requester/instructor's own comment, cancellation and appeal keep student-action routing", async () => {
  await captureNotifications(
    [ownInstructor, instructor],
    async (notifications, sent) => {
      const comment: ThreadEntry = {
        id: "followup",
        from: student.email,
        timestamp,
        kind: "comment",
        text: "Additional information.",
      };
      await notifications.notifyRequestUpdate(ownRequest, [comment]);
      for (const status of ["cancelled", "appealed"] as const) {
        const entry: ThreadEntry = {
          id: status,
          from: student.email,
          timestamp,
          kind: "status",
          status,
        };
        await notifications.notifyRequestUpdate(
          { ...ownRequest, status, thread: [...ownRequest.thread, entry] },
          [entry],
        );
      }
      expect(sent.map((mail) => mail.subject)).toEqual(
        ["Comment", "Cancelled", "Appealed"].map(
          (prefix) => `${prefix} - ${Classes.format(clazz)} (Final)`,
        ),
      );
      for (const mail of sent) {
        expect(mail.to).toEqual([student.email, instructor.email]);
        expect(mail.cc).toEqual([observer.email]);
        expect(mail.html).toContain("Dear Instructor, Student,");
      }
    },
  );
});
