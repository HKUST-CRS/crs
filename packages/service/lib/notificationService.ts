import fs from "node:fs/promises";
import path from "node:path";
import handlebars, { Exception } from "handlebars";
import nodemailer from "nodemailer";
import type { Request } from "../models";

export class NotificationService {
  private transporter: nodemailer.Transporter;
  private templateDir: string;
  private requestBaseUrl: URL;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: Bun.env.SMTP_HOST,
      port: Number(Bun.env.SMTP_PORT),
      secure: Number(Bun.env.SMTP_PORT) === 465,
      ...(Bun.env.SMTP_USER && Bun.env.SMTP_PASS && {auth: {
        user: Bun.env.SMTP_USER,
        pass: Bun.env.SMTP_PASS,
      }}),
      connectionTimeout: 5000,
    });
    this.templateDir =
      Bun.env.EMAIL_TEMPLATES_DIR || path.join(__dirname, "../templates");
    if (!Bun.env.BASE_URL) throw new Exception("BASE_URL not found");
    this.requestBaseUrl = new URL("request", Bun.env.BASE_URL);
  }

  /**
   * Send an email notification for a new request.
   * @param to The emails of responsible instructors (tentative).
   * @param cc The email of the requester (tentative).
   * @param request The request made.
   */
  async sendNewRequestEmail(to: string[], cc: string[], request: Request) {
    const subject = "New Request Received in CSE Request System";
    const link = new URL(request.id, this.requestBaseUrl).toString();
    await this.sendEmail(to, cc, subject, "new_request.html", { link });
  }

  /**
   * Send an email notification when a request is handled.
   * @param to The email of the requester (tentative).
   * @param cc The emails of the instructors and TAs (tentative).
   * @param request The request.
   */
  async sendRequestHandledEmail(to: string[], cc: string[], request: Request) {
    if (!request.response) {
      throw new Exception("Request does not have a response yet");
    }
    const subject = "Request Handled in CSE Request System";
    const link = new URL(request.id, this.requestBaseUrl).toString();
    await this.sendEmail(to, cc, subject, "request_handled.html", {
      link,
      decision: request.response.decision,
      remarks: request.response.remarks,
    });
  }

  private async renderTemplate(
    templateName: string,
    context: Record<string, string>,
  ): Promise<string> {
    const templatePath = path.join(this.templateDir, templateName);
    const source = await fs.readFile(templatePath, "utf-8");
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
    try {
      await this.transporter.sendMail({
        from: Bun.env.EMAIL_FROM,
        sender: "CSE Request System",
        to,
        cc,
        subject,
        html,
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}
