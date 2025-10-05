import path from "node:path";
import handlebars, { Exception } from "handlebars";
import nodemailer from "nodemailer";
import type { Request } from "../models";
import { ResponseNotFoundError } from "./error";
import type { UserService } from "./userService";

type NotificationServiceDependencies = {
  user: UserService;
};

export class NotificationService {
  private services: NotificationServiceDependencies;

  private transporter: nodemailer.Transporter;
  private templateDir: string;
  private requestBaseUrl: URL;

  constructor(services: NotificationServiceDependencies) {
    this.services = services;
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
    this.requestBaseUrl = new URL("request", Bun.env.BASE_URL);
  }

  /**
   * Notify the responsible instructors, and the requester, for a new request.
   * @param request The request made.
   */
  async notifyNewRequest(request: Request) {
    const subject = "[CSE Request System] New Request";

    const instructors = await this.services.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const student = await this.services.user.getUser(request.from);

    const instructorEmails = instructors.map((i) => i.email);
    const instructorNames = instructors.map((i) => i.name).join(", ");

    const studentEmail = student.email;
    const studentName = student.name;

    const link = new URL(request.id, this.requestBaseUrl).toString();

    await this.sendEmail(
      instructorEmails,
      [studentEmail],
      subject,
      "new_request.html",
      { link, instructorNames, studentName },
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
    const subject = "[CSE Request System] New Response";

    const student = await this.services.user.getUser(request.from);
    const instructor = await this.services.user.getUser(request.response.from);
    const instructors = await this.services.user.getUsersFromClass(
      request.class,
      "instructor",
    );
    const tas = await this.services.user.getUsersFromClass(request.class, "ta");

    const studentEmail = student.email;
    const studentName = student.name;
    const instructorEmail = instructor.email;
    const instructorName = instructor.name;

    const instructorEmails = instructors.map((i) => i.email);
    const taEmails = tas.map((i) => i.email);

    const link = new URL(request.id, this.requestBaseUrl).toString();
    await this.sendEmail(
      [studentEmail],
      [instructorEmail, ...instructorEmails, ...taEmails],
      subject,
      "new_response.html",
      {
        link,
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
