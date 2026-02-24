import path from "node:path";
import { evaluate } from "@mdx-js/mdx";
import nodemailer from "nodemailer";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Classes,
  type Request,
  type RequestDetails,
  type User,
} from "../models";
import { Signature } from "../models/request/Signature";
import type { Repos } from "../repos";
import { formatRequest } from "../templates/Formatter";
import { compareString } from "../utils/comparison";
import { ResponseNotFoundError } from "./error";

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

  private urlToResponse(rid: string): string {
    return new URL(`/response/${rid}`, this.baseUrl).toString();
  }

  /**
   * Notify the responsible instructors, observers, and the requester, for a new request.
   * @param request The request made.
   */
  async notifyNewRequest(request: Request) {
    const subject = `Request - ${Classes.format(request.class)}`;

    const student = await this.repos.user.requireUser(request.from);
    const instructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const observers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );

    const content = await this.renderNewRequest(request, {
      student,
      instructors,
    });

    await this.sendEmail(
      instructors.map((i) => i.email),
      [student.email, ...observers.map((i) => i.email)],
      subject,
      content,
      request.details.proof ?? [],
    );
  }

  private async renderNewRequest(
    request: Request,
    {
      student,
      instructors,
    }: {
      student: User;
      instructors: User[];
    },
  ): Promise<string> {
    const StudentLine = (() => {
      if (student.name) {
        return student.name;
      } else {
        return "Student";
      }
    })();
    const InstructorLine = (() => {
      const is = instructors.map((i) => i.name).filter((name) => name !== "");
      if (is.length === 0) {
        return "Course Instructors";
      } else {
        return is.sort(compareString).join(", ");
      }
    })();
    const Link = this.urlToResponse(request.id);
    const Summary = formatRequest(request, {
      student,
      instructors,
    });

    const templatePath = path.join(this.templateDir, "new_request.mdx");
    const templateFile = Bun.file(templatePath);

    const module = await evaluate(await templateFile.text(), runtime);

    return renderToStaticMarkup(
      createElement(module.default, {
        StudentLine,
        InstructorLine,
        Link,
        Summary,
        ID: request.id,
        Sig: await Signature.sign(request),
      }),
    );
  }

  /**
   * Notify the requester, and the responsible instructors and observers, for a new response.
   * @param request The request on which the response is made.
   */
  async notifyNewResponse(request: Request) {
    if (!request.response) {
      throw new ResponseNotFoundError(request.id);
    }
    const subject = `Response - ${Classes.format(request.class)}`;

    const student = await this.repos.user.requireUser(request.from);
    const instructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const observers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );

    const content = await this.renderNewResponse(request, {
      student,
      instructors,
    });

    await this.sendEmail(
      [student.email],
      [...instructors.map((i) => i.email), ...observers.map((i) => i.email)],
      subject,
      content,
      request.details.proof ?? [],
    );
  }

  private async renderNewResponse(
    request: Request,
    {
      student,
      instructors,
    }: {
      student: User;
      instructors: User[];
    },
  ): Promise<string> {
    const response = request.response;
    if (!response) {
      throw new ResponseNotFoundError(request.id);
    }
    const StudentLine = (() => {
      if (student.name) {
        return student.name;
      } else {
        return "Student";
      }
    })();
    const InstructorLine = (() => {
      const is = instructors.map((i) => i.name).filter((name) => name !== "");
      if (is.length === 0) {
        return "Course Instructors";
      } else {
        return is.sort(compareString).join(", ");
      }
    })();
    const Link = this.urlToResponse(request.id);
    const Summary = formatRequest(request, {
      student,
      instructors,
    });

    const templatePath = path.join(this.templateDir, "new_response.mdx");
    const templateFile = Bun.file(templatePath);

    const module = await evaluate(await templateFile.text(), runtime);

    return renderToStaticMarkup(
      createElement(module.default, {
        StudentLine,
        InstructorLine,
        Link,
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
    attachments: NonNullable<RequestDetails["proof"]>,
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
      attachments: attachments.map((f) => ({
        filename: f.name,
        content: f.content,
        encoding: "base64",
      })),
    });
  }
}
