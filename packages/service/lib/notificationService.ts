import path from "node:path";
import handlebars from "handlebars";
import nodemailer from "nodemailer";
import { Classes, type Request } from "../models";
import type { Repos } from "../repos";
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
          "SMTP configuration is incomplete. Emails are suppressed.",
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
    const subject = `New Request for ${Classes.format(request.class)}`;

    const student = await this.repos.user.requireUser(request.from);
    const studentName = student.name;
    const studentEmail = student.email;

    const classInstructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const classInstructorEmails = classInstructors.map((i) => i.email);
    const classInstructorNames = classInstructors
      .map((i) => i.name)
      .filter((name) => name !== "")
      .sort(compareString)
      .join(", ");

    const classObservers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );
    const classObserverEmails = classObservers.map((i) => i.email);

    const link = this.urlToResponse(request.id);

    await this.sendEmail(
      classInstructorEmails,
      [studentEmail, ...classObserverEmails],
      subject,
      "new_request.hbs",
      {
        studentName,
        instructorNames: classInstructorNames,
        link,
        className: Classes.format(request.class),
      },
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
    const subject = `New Response for ${Classes.format(request.class)}`;

    const student = await this.repos.user.requireUser(request.from);
    const studentName = student.name;
    const studentEmail = student.email;

    const instructor = await this.repos.user.requireUser(request.response.from);
    const instructorName = instructor.name;

    const classInstructors = await this.repos.user.getUsersInClass(
      request.class,
      "instructor",
    );
    const classInstructorEmails = classInstructors.map((i) => i.email);
    const classObservers = await this.repos.user.getUsersInClass(
      request.class,
      "observer",
    );
    const classObserverEmails = classObservers.map((i) => i.email);

    const link = this.urlToResponse(request.id);

    await this.sendEmail(
      [studentEmail],
      [...classInstructorEmails, ...classObserverEmails],
      subject,
      "new_response.hbs",
      {
        studentName,
        instructorName,
        link,
        className: Classes.format(request.class),
        decision: request.response.decision,
        remarks: request.response.remarks,
      },
    );
  }

  private async renderTemplate(
    templateName: string,
    context: Record<string, string>,
  ): Promise<string> {
    const templatePath = path.join(this.templateDir, templateName);
    const templateFile = Bun.file(templatePath);
    const source = await templateFile.text();
    const template = handlebars.compile(source);
    return template(context);
  }

  private async sendEmail(
    to: string[],
    cc: string[],
    subject: string,
    templateName: string,
    context: Record<string, string>,
  ): Promise<void> {
    const html = await this.renderTemplate(templateName, context);
    if (!this.transporter) {
      console.warn(
        "Email sending is suppressed due to incomplete SMTP configuration.",
      );
      console.warn("Sending", { to, cc, subject }, "with content", "\n", html);
      return;
    }
    await this.transporter.sendMail({
      from: Bun.env.EMAIL_FROM,
      sender: "CSE Request System",
      to,
      cc,
      subject,
      html,
    });
  }
}
