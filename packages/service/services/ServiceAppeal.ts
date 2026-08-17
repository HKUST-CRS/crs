import type {
  Appeal,
  AppealHead,
  AppealID,
  AppealInit,
  Course,
  CourseID,
  MessageInit,
  Role,
  User,
  UserID,
} from "../models";
import type { Repos } from "../repos";
import {
  AppealClosedError,
  AppealParticipantExistsError,
  AppealPermissionError,
  AssignmentNotFoundError,
  AssignmentNotGradedError,
} from "./error";
import { assertCourseRole } from "./permission";

const ROLE_PRIORITY: Role[] = ["admin", "instructor", "observer", "student"];

export class AppealService<TUser extends UserID | null = null> {
  public user: TUser;
  constructor(repos: Repos);
  constructor(repos: Repos, user: TUser);
  constructor(
    private repos: Repos,
    user?: TUser,
  ) {
    this.user = (user ?? null) as TUser;
  }
  auth(this: AppealService<null>, user: string): AppealService<string> {
    return new AppealService(this.repos, user);
  }

  /**
   * Creates an appeal.
   *
   * The user must be a student in the class that the appeal is for in order to create the appeal.
   *
   * The assignment must exist and be graded in order to create the appeal.
   *
   * @param init The appeal initialization data.
   * @param message The initial message for the appeal.
   * @returns The ID of the created appeal.
   */
  async createAppeal(
    this: AppealService<UserID>,
    init: AppealInit,
    message: MessageInit,
  ): Promise<AppealID> {
    const user = await this.repos.user.requireUser(this.user);
    assertCourseRole(user, init.course, ["student"], "creating appeal");
    const course = await this.repos.course.requireCourse(init.course);
    const assignment = course.assignments[init.assignment];
    if (!assignment) {
      throw new AssignmentNotFoundError(init.course, init.assignment);
    }
    if (assignment.state !== "graded") {
      throw new AssignmentNotGradedError(init.course, init.assignment);
    }
    const participants = this.resolveParticipants(
      course,
      user,
      init.assignment,
    );
    const appealID = await this.repos.appeal.createAppeal(
      this.user,
      init,
      participants,
    );
    const role = this.resolveRole(user, init.course);
    await this.repos.appeal.postMessage(this.user, appealID, message, role);
    return appealID;
  }

  /**
   * A helper function to resolve the participants of an appeal based on
   * the course, student, and assignment.
   *
   *
   * @param course The course that the appeal is for.
   * @param student The student who is creating the appeal.
   * @param assignment The assignment that the appeal is for.
   * @returns An array of user IDs representing the participants of the appeal.
   */
  private resolveParticipants(
    course: Course,
    student: User,
    assignment: string,
  ): UserID[] {
    const tas = course.assignments[assignment]?.tas ?? [];
    const lecturerEmails: UserID[] = [];
    for (const enrollment of student.enrollment) {
      if (
        enrollment.role !== "student" ||
        enrollment.course.code !== course.code ||
        enrollment.course.term !== course.term
      ) {
        continue;
      }
      if (enrollment.section === "*") {
        for (const section of Object.values(course.sections)) {
          if (section.type === "Lecture") {
            lecturerEmails.push(...(section.lecturers ?? []));
          }
        }
      } else if (enrollment.section.match(/^\(.*\)$/)) {
      } else {
        const section = course.sections[enrollment.section];
        if (section?.type === "Lecture") {
          lecturerEmails.push(...(section.lecturers ?? []));
        }
      }
    }
    return [...new Set([student.email, ...tas, ...lecturerEmails])];
  }

  /**
   * Resolves the role the user holds in the course, or undefined
   * if the user has no enrollment in the course.
   *
   * The role is stamped on a message at post time (frozen), so a badge shows
   * the sender's role when the message was written rather than their current
   * role.
   *
   * @param user The user whose role is being resolved.
   * @param course The course in which the role is being resolved.
   * @returns The most senior role, or undefined if the user has no enrollment.
   */
  private resolveRole(user: User, course: CourseID): Role | undefined {
    const enrollments = user.enrollment.filter(
      (e) => e.course.code === course.code && e.course.term === course.term,
    );
    for (const role of ROLE_PRIORITY) {
      if (enrollments.some((e) => e.role === role)) return role;
    }
    return undefined;
  }

  /**
   * Gets an appeal by its ID.
   *
   * The current user can access an appeal if they are a participant of the appeal.
   *
   * @param appealID The ID of the appeal to fetch.
   * @returns The appeal with the specified ID.
   */
  async getAppeal(
    this: AppealService<UserID>,
    appealID: AppealID,
  ): Promise<Appeal> {
    const user = await this.repos.user.requireUser(this.user);
    const appeal = await this.repos.appeal.requireAppeal(appealID);
    if (!appeal.participants.includes(user.email)) {
      throw new AppealPermissionError(this.user, appealID);
    }
    return appeal;
  }

  /**
   * Posts a message to an appeal.
   *
   * The current user must be a participant in the appeal in order to post a message.
   *
   * @param appealID The ID of the appeal to post the message to.
   * @param message The message to post.
   */
  async postMessage(
    this: AppealService<UserID>,
    appealID: AppealID,
    message: MessageInit,
  ): Promise<void> {
    const user = await this.repos.user.requireUser(this.user);
    const appeal = await this.repos.appeal.requireAppeal(appealID);
    if (!appeal.participants.includes(user.email)) {
      throw new AppealPermissionError(this.user, appealID);
    }
    const role = this.resolveRole(user, appeal.course);
    await this.repos.appeal.postMessage(this.user, appealID, message, role);
  }

  /**
   * Gets the appeal heads for the current user.
   *
   * @returns
   */
  async getAppealHeads(this: AppealService<UserID>): Promise<AppealHead[]> {
    return await this.repos.appeal.getAppealHeadsFromUser(this.user);
  }

  /**
   * Invites an instructor or observer of the appeal's course to join the appeal.
   *
   * The current user must be a participant of the appeal and hold the
   * instructor or admin role in the appeal's course. The appeal must be open.
   * The invitee must hold the instructor or observer role in the appeal's
   * course, and must not already be a participant.
   *
   * @param appealID The ID of the appeal to invite to.
   * @param invitee The email of the user to invite.
   */
  async inviteParticipant(
    this: AppealService<UserID>,
    appealID: AppealID,
    invitee: UserID,
  ): Promise<void> {
    const inviter = await this.repos.user.requireUser(this.user);
    const appeal = await this.repos.appeal.requireAppeal(appealID);
    if (!appeal.participants.includes(inviter.email)) {
      throw new AppealPermissionError(this.user, appealID);
    }
    assertCourseRole(
      inviter,
      appeal.course,
      ["instructor", "admin"],
      "inviting a participant to the appeal",
    );
    if (appeal.state !== "open") {
      throw new AppealClosedError(appealID);
    }
    if (appeal.participants.includes(invitee)) {
      throw new AppealParticipantExistsError(appealID, invitee);
    }
    const inviteeUser = await this.repos.user.requireUser(invitee);
    assertCourseRole(
      inviteeUser,
      appeal.course,
      ["instructor", "observer"],
      "being invited to the appeal",
    );
    await this.repos.appeal.addParticipant(appealID, invitee);
  }
}
