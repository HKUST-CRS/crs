import { expect, mock, spyOn, test } from "bun:test";
import nodemailer, { type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type { Course, Request, User } from "../models";
import { Signature } from "../models/request/Signature";
import type { Repos } from "../repos";
import { NotificationService } from "../services/ServiceNotification";

test("exam notifications include only an enrolled assigned grader and follow revocation", async () => {
  const student: User = {
    email: "student@connect.ust.hk",
    name: "Student",
    enrollment: [],
    sudoer: false,
  };
  const grader: User = {
    email: "q1ta@ust.hk",
    name: "Question One Grader",
    enrollment: [
      {
        role: "grader",
        course: { code: "COMP 1023", term: "2610" },
        section: "L1",
      },
    ],
    sudoer: false,
  };
  const course: Course = {
    code: "COMP 1023",
    term: "2610",
    title: "Programming",
    sections: { L1: { schedule: [] } },
    assignments: {},
    exams: {
      Midterm: {
        questions: [
          { question: "Q1", grader: grader.email },
          { question: "Q2", grader: "q2ta@ust.hk" },
        ],
      },
    },
    effectiveRequestTypes: {
      "Swap Section": true,
      "Absent from Section": true,
      "Deadline Extension": true,
      "Examination Appeal": true,
    },
  };
  const request: Request = {
    id: "exam-request",
    from: student.email,
    class: { course: { code: course.code, term: course.term }, section: "L1" },
    type: "Examination Appeal",
    metadata: { examCode: "Midterm", question: "Q1" },
    timestamp: "2026-10-13T12:00:00+08:00",
    status: "open",
    thread: [
      {
        id: "opening",
        from: student.email,
        timestamp: "2026-10-13T12:00:00+08:00",
        kind: "comment",
        text: "My correct answer received zero marks.",
      },
    ],
  };
  const repos = {
    user: {
      requireUser: async (email: string) =>
        email === grader.email ? grader : student,
      getUsersInClass: async () => [],
      getUser: async (email: string) =>
        email === grader.email ? grader : null,
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
    EMAIL_FROM: "review@ust.hk",
    BASE_URL: "https://example.test",
  });
  try {
    await new NotificationService(repos).notifyRequestUpdate(request);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual([grader.email]);
    expect(sent[0]?.subject).toContain("Midterm Q1");
    expect(sent[0]?.html).toContain("question Q1");
    expect(sent[0]?.html).toContain("My correct answer received zero marks.");
    expect(JSON.stringify(sent[0])).not.toContain("q2ta@ust.hk");
    const notification = new NotificationService(repos);
    await notification.notifyRequestUpdate(request, [
      {
        id: "review",
        from: grader.email,
        kind: "comment",
        text: "Reviewed",
        timestamp: request.timestamp,
      },
    ]);
    expect(sent[1]?.to).toEqual([student.email]);
    expect(sent[1]?.cc).toEqual([grader.email]);
    grader.enrollment = [];
    await notification.notifyRequestUpdate(request);
    expect(sent[2]?.to).toEqual([]);
    expect(sent[2]?.cc).toEqual([student.email]);
    expect(JSON.stringify(sent[2])).not.toContain(grader.email);
  } finally {
    transport.mockRestore();
    signature.mockRestore();
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete Bun.env[key];
      else Bun.env[key] = previous[index];
    });
  }
});
