import path from "node:path";
import handlebars from "handlebars";
import nodemailer from "nodemailer";
import type { Request } from "../models";
import type { Repos } from "../repos";
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
        this.baseUrl = "";
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

  private urlToResponse(rid: string): string {
    return new URL(`/response/${rid}`, this.baseUrl).toString();
  }

  /**
   * Notify the responsible instructors, and the requester, for a new request.
   * @param request The request made.
   */
  async notifyNewRequest(request: Request) {
    const subject = "New Request";

    const instructors = await this.repos.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const student = await this.repos.user.requireUser(request.from);

    const instructorEmails = instructors.map((i) => i.email);
    const instructorNames = instructors.map((i) => i.name).join(", ");

    const studentEmail = student.email;
    const studentName = student.name;

    const requestLink = this.urlToRequest(request.id);
    const responseLink = this.urlToResponse(request.id);

    await this.sendEmail(
      instructorEmails,
      [studentEmail],
      subject,
      "new_request.hbs",
      { requestLink, responseLink, instructorNames, studentName },
    );
  }

  /**
   * Notify the requester, and the responsible instructors and TAs, for a new response.
   * @param request The request on which the response is made.
   */
  async notifyNewResponse(request: Request) {
    if (!request.response) {
      throw new ResponseNotFoundError(request.id);
    }
    const subject = "New Response";

    const student = await this.repos.user.requireUser(request.from);
    const instructor = await this.repos.user.requireUser(request.response.from);
    const instructors = await this.repos.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const tas = await this.repos.user.getUsersFromClass(request.class, "ta");

    const studentEmail = student.email;
    const studentName = student.name;
    const instructorName = instructor.name;

    const instructorEmails = instructors.map((i) => i.email);
    const taEmails = tas.map((i) => i.email);

    const responseLink = this.urlToResponse(request.id);

    await this.sendEmail(
      [studentEmail],
      [...instructorEmails, ...taEmails],
      subject,
      "new_response.hbs",
      {
        responseLink,
        decision: request.response.decision,
        remarks: request.response.remarks,
        studentName,
        instructorName,
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
