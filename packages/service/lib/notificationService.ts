import path from "node:path";
import handlebars, { Exception } from "handlebars";
import nodemailer from "nodemailer";
import type { Collections } from "../db";
import type { Request } from "../models";
import { BaseService } from "./baseService";
import { ResponseNotFoundError } from "./error";

export class NotificationService extends BaseService {
  private transporter: nodemailer.Transporter;
  private templateDir: string;

  private baseUrl: string;

  constructor(collections: Collections) {
    super(collections);
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
    this.templateDir =
      Bun.env.EMAIL_TEMPLATES_DIR || path.join(__dirname, "../templates");
    if (!Bun.env.BASE_URL) throw new Exception("BASE_URL not found");
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

    const instructors = await this.functions.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const student = await this.functions.user.requireUser(request.from);

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
      "new_request.html",
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

    const student = await this.functions.user.requireUser(request.from);
    const instructor = await this.functions.user.requireUser(
      request.response.from,
    );
    const instructors = await this.functions.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const tas = await this.functions.user.getUsersFromClass(
      request.class,
      "ta",
    );

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
      "new_response.html",
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
