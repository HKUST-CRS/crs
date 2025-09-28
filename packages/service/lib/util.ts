import type { ObjectId } from "mongodb";
import type { CourseId, UserId } from "../models";

export function UserNotFound(userId: UserId) {
  return new Error(`User ${userId} not found`);
}

export function CourseNotFound(courseId: CourseId) {
  return new Error(`Course ${courseId.code} (${courseId.term}) not found`);
}

export function SectionNotFound(courseId: CourseId, section: string) {
  return new Error(
    `Section ${section} not found in course ${courseId.code} (${courseId.term})`,
  );
}

export function RequestNotFound(requestId: ObjectId) {
  return new Error(`Request ${requestId.toHexString()} not found`);
}

export function RequestHasResponse(requestId: ObjectId) {
  return new Error(`Request ${requestId.toHexString()} already has a response`);
}
