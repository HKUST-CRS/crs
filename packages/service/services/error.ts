import {
  type Class,
  Classes,
  type CourseID,
  Courses,
  type RequestType,
  type Role,
  type UserID,
} from "../models";

export class PermissionError extends Error {
  constructor(uid: UserID, roles: Role[], operation: string) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(`User ${uid} does not have ${roleStr} for ${operation}.`);
    this.name = "PermissionError";
  }
}

export class CoursePermissionError extends Error {
  constructor(
    userID: UserID,
    roles: Role[],
    courses: CourseID[],
    operation: string,
  ) {
    const roleStr =
      roles.length > 0 ? `role(s) ${roles.join("/")}` : "any role";
    const coursesStr =
      courses.length > 0
        ? `courses ${courses.map(Courses.formatID).join(", ")}`
        : "no courses (internal error!)";
    super(
      `User ${userID} does not have ${roleStr} in ${coursesStr} for ${operation}.`,
    );
    this.name = "CoursePermissionError";
  }
}

export class ClassPermissionError extends Error {
  constructor(
    userID: UserID,
    roles: Role[],
    classes: Class[],
    operation: string,
  ) {
    const roleStr =
      roles.length > 0 ? `role(s) ${roles.join("/")}` : "any role";
    const classesStr =
      classes.length > 0
        ? `classes ${classes.map(Classes.format).join(", ")}`
        : "no classes (internal error!)";
    super(
      `User ${userID} does not have ${roleStr} in ${classesStr} for ${operation}.`,
    );
    this.name = "ClassPermissionError";
  }
}

export class SudoerPermissionError extends Error {
  constructor(userID: UserID, operation: string) {
    super(`User ${userID} is not a sudoer and cannot perform ${operation}.`);
    this.name = "SudoerPermissionError";
  }
}

export class RequestTypeNotEffectiveError extends Error {
  constructor(courseID: CourseID, type: RequestType) {
    super(
      `Request type ${type} is not effective for course ${Courses.formatID(courseID)}.`,
    );
    this.name = "RequestTypeNotEffectiveError";
  }
}

export class DeadlineExtensionNotAllowedError extends Error {
  constructor(courseID: CourseID, assignment: string) {
    super(
      `Deadline extension for assignment ${assignment} is not allowed for course ${Courses.formatID(courseID)}.`,
    );
    this.name = "DeadlineExtensionNotAllowedError";
  }
}

export class InvalidRequestError extends Error {
  constructor(courseID: CourseID, type: RequestType) {
    super(
      `Request data for ${type} is not valid for course ${Courses.formatID(courseID)}.`,
    );
    this.name = "InvalidRequestError";
  }
}
