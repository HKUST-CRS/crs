import path from "node:path";
import { evaluate } from "@mdx-js/mdx";
import nodemailer from "nodemailer";
import { createElement, Fragment } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Classes,
  type ProofFile,
  type Request,
  type RequestStatus,
  type ThreadEntry,
  type User,
  type UserID,
} from "../models";
import { Signature } from "../models/request/Signature";
import type { Repos } from "../repos";
import { formatRequest, formatUpdate } from "../templates/Formatter";
import { compareString } from "../utils/comparison";

const STATUS_SUBJECT: Record<RequestStatus, string> = {
  open: "Reopened",
  approved: "Approved",
  rejected: "Rejected",
  appealed: "Appealed",
  cancelled: "Cancelled",
};

export class NotificationService {
  private templateDir: string;
  private transporter: nodemailer.Transporter | null;
  private baseUrl: string;

  constructor(private repos: Repos) {
    this.templateDir =
      Bun.env.EMAIL_TEMPLATES_DIR || path.join(__dirname, "../templates");

    if (
      !Bun.env.SMTP_HOST ||
      !Bun.env.SMTP_PORT ||
      !Bun.env.EMAIL_FROM ||
      !Bun.env.BASE_URL
    ) {
      if (Bun.env.NODE_ENV === "production") {
        throw new Error(
          "SMTP configuration is incomplete. Missing one of SMTP_HOST, SMTP_PORT, EMAIL_FROM, or BASE_URL.",
        );
      } else {
        console.warn(
          "SMTP configuration is incomplete. Emails are printed to the console.",
        );
        this.transporter = null;
        this.baseUrl = "https://crs.cse.ust.hk";
        return;
      }
    }

    this.transporter = nodemailer.createTransport({
      host: Bun.env.SMTP_HOST,
      port: Number(Bun.env.SMTP_PORT),
      secure: Number(Bun.env.SMTP_PORT) === 465,
      ...(Bun.env.SMTP_USER &&
        Bun.env.SMTP_PASS && {
          auth: {
            user: Bun.env.SMTP_USER,
            pass: Bun.env.SMTP_PASS,
          },
        }),
      connectionTimeout: 5000,
    });
    this.baseUrl = Bun.env.BASE_URL;
  }

  private urlToRequest(rid: string): string {
    return new URL(`/request/${rid}`, this.baseUrl).toString();
  }

  /**
   * Notify the relevant parties of a thread update. A single action may
   * append multiple entries (e.g. a decision with a comment records the
   * comment then a status change); all are rendered together in one
   * email. Student actions notify the instructors (with the student and
   * observers CC'd); instructor actions notify the student (with
   * instructors and observers CC'd).
   *
   * @param request The request on which the update was made.
   * @param entries The thread entries describing the update. Omit for a
   * new request.
   */
  async notifyRequestUpdate(request: Request, entries: ThreadEntry[] = []) {
    // Assignment Appeal: notify only the participants — the appealing student,
    // the section's lecturers, and the assignment's TAs — instead of the
    // class-wide instructor/observer rosters.
    if (request.participants) {
      return this.notifyAppealUpdate(request, request.participants, entries);
    }
    const student = await this.repos.user.requireUser(request.from);
    const instructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const observers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );

    const actor = entries[0]?.from ?? request.from;
    const statusEntry = entries.find((e) => e.kind === "status");
    const subjectPrefix = statusEntry
      ? STATUS_SUBJECT[statusEntry.status]
      : entries.length === 0
        ? "Request"
        : "Comment";
    const subject = `${subjectPrefix} - ${Classes.format(request.class)}`;

    const content = await this.renderUpdate(
      request,
      entries,
      student,
      instructors,
      observers,
    );

    const notificationEntries = entries.length > 0 ? entries : request.thread;
    const attachments = notificationEntries.flatMap((e) =>
      e.kind === "comment" ? (e.proofs ?? []) : [],
    );

    if (actor === request.from) {
      await this.sendEmail(
        instructors.map((i) => i.email),
        [student.email, ...observers.map((i) => i.email)],
        subject,
        content,
        attachments,
      );
    } else {
      await this.sendEmail(
        [student.email],
        [...instructors.map((i) => i.email), ...observers.map((i) => i.email)],
        subject,
        content,
        attachments,
      );
    }
  }

  /**
   * Notify the participants of an appeal of a thread update. The actor is
   * excluded: a student action reaches the responsible staff (lecturers + TAs);
   * a staff action reaches the student and the other participants. No CC'd
   * observers — observers are never participants of an appeal.
   */
  private async notifyAppealUpdate(
    request: Request,
    participants: UserID[],
    entries: ThreadEntry[] = [],
  ): Promise<void> {
    const student = await this.repos.user.requireUser(request.from);
    const staff = await this.repos.user.getUsersByEmail(
      participants.filter((email) => email !== request.from),
    );
    const actor = entries[0]?.from ?? request.from;
    const recipients = participants.filter((email) => email !== actor);
    const statusEntry = entries.find((e) => e.kind === "status");
    const subjectPrefix = statusEntry
      ? STATUS_SUBJECT[statusEntry.status]
      : entries.length === 0
        ? "Appeal"
        : "Comment";
    const subject = `${subjectPrefix} - ${Classes.format(request.class)}`;
    const content = await this.renderUpdate(
      request,
      entries,
      student,
      staff,
      [],
    );
    const notificationEntries = entries.length > 0 ? entries : request.thread;
    const attachments = notificationEntries.flatMap((e) =>
      e.kind === "comment" ? (e.proofs ?? []) : [],
    );
    await this.sendEmail(recipients, [], subject, content, attachments);
  }

  private async renderUpdate(
    request: Request,
    entries: ThreadEntry[],
    student: User,
    instructors: User[],
    observers: User[],
  ): Promise<string> {
    const actor = entries[0]?.from ?? request.from;
    const isStudentAction = actor === request.from;

    const instructorLine = (() => {
      const is = instructors.map((i) => i.name).filter((name) => name !== "");
      if (is.length === 0) {
        return "Course Instructors";
      } else {
        return is.sort(compareString).join(", ");
      }
    })();
    const studentLine = student.name || "Student";

    const Recipient = isStudentAction ? instructorLine : studentLine;
    const Sender = isStudentAction ? studentLine : instructorLine;
    const Link = this.urlToRequest(request.id);
    const isNewRequest = entries.length === 0;
    const Update = isNewRequest
      ? formatRequest(request, { student, instructors, observers })
      : createElement(
          Fragment,
          null,
          ...entries.map((e) =>
            formatUpdate(e, { student, instructors, observers }),
          ),
        );
    const Summary = isNewRequest
      ? null
      : formatRequest(request, { student, instructors, observers });

    const templatePath = path.join(this.templateDir, "new_update.mdx");
    const templateFile = Bun.file(templatePath);

    const module = await evaluate(await templateFile.text(), runtime);

    return renderToStaticMarkup(
      createElement(module.default, {
        Recipient,
        Sender,
        Link,
        Update,
        Summary,
        ID: request.id,
        Sig: await Signature.sign(request),
      }),
    );
  }

  private async sendEmail(
    to: string[],
    cc: string[],
    subject: string,
    content: string,
    attachments: ProofFile[],
  ): Promise<void> {
    if (!this.transporter) {
      console.warn(
        "Email sending is suppressed due to incomplete SMTP configuration.",
      );
      console.warn(
        "Sending",
        { to, cc, subject },
        "with content",
        "\n",
        content,
      );
      return;
    }
    await this.transporter.sendMail({
      from: Bun.env.EMAIL_FROM,
      sender: "CSE Request System",
      to,
      cc,
      subject,
      html: content,
      attachments: await Promise.all(
        attachments.map(async (f) => ({
          filename: f.name,
          content: await this.repos.request.fetchProof(f.id),
          encoding: "base64",
        })),
      ),
    });
  }
}
