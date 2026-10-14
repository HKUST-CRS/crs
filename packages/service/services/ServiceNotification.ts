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
} from "../models";
import { Signature } from "../models/request/Signature";
import type { Repos } from "../repos";
import { formatRequest, formatUpdate } from "../templates/Formatter";
import { requestPresentation } from "../templates/RequestPresentation";
import { compareString } from "../utils/comparison";
import { resolveExamGrader } from "./ServiceRequest";

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
    const student = await this.repos.user.requireUser(request.from);
    const instructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const graderEmail = await resolveExamGrader(this.repos, request);
    if (
      graderEmail &&
      !instructors.some((user) => user.email === graderEmail)
    ) {
      const grader = await this.repos.user.requireUser(graderEmail);
      instructors.push(grader);
    }
    const observers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );

    const statusEntry = entries.find((e) => e.kind === "status");
    const isDecision =
      statusEntry?.status === "approved" || statusEntry?.status === "rejected";
    const isStudentAction =
      (entries[0]?.from ?? request.from) === request.from && !isDecision;
    let subjectPrefix = "Request";
    if (statusEntry) subjectPrefix = STATUS_SUBJECT[statusEntry.status];
    else if (entries.length > 0) subjectPrefix = "Comment";
    const subject = `${subjectPrefix} - ${Classes.format(request.class)}${requestPresentation(request).subjectSuffix}`;

    const content = await this.renderUpdate(
      request,
      entries,
      student,
      instructors,
      observers,
      isStudentAction,
    );

    const notificationEntries = entries.length > 0 ? entries : request.thread;
    const attachments = notificationEntries.flatMap((e) =>
      e.kind === "comment" ? (e.proofs ?? []) : [],
    );

    if (isStudentAction) {
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

  private async renderUpdate(
    request: Request,
    entries: ThreadEntry[],
    student: User,
    instructors: User[],
    observers: User[],
    isStudentAction: boolean,
  ): Promise<string> {
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
    cc = cc.filter((email) => !to.includes(email));
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
