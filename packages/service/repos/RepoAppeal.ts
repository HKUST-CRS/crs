import { DateTime } from "luxon";
import { MongoServerError, ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Appeal,
  AppealHead,
  AppealID,
  AppealInit,
  CourseID,
  MessageInit,
  UserID,
} from "../models";
import { toISO } from "../utils/datetime";
import { AppealAlreadyExistsError, AppealNotFoundError } from "./error";

export class AppealRepo {
  constructor(protected collections: Collections) {}

  async requireAppeal(appealID: AppealID): Promise<Appeal> {
    const appeal = await this.collections.appeals.findOne({ id: appealID });
    if (!appeal) throw new AppealNotFoundError(appealID);
    return appeal;
  }

  async requireAppealByKey(
    course: CourseID,
    assignment: string,
    student: UserID,
  ): Promise<Appeal> {
    const appeal = await this.collections.appeals.findOne({
      "course.code": course.code,
      "course.term": course.term,
      assignment,
      student,
    });
    if (!appeal) throw new AppealNotFoundError(course, assignment, student);
    return appeal;
  }

  async createAppeal(
    student: UserID,
    init: AppealInit,
    participants: UserID[],
  ): Promise<AppealID> {
    const id = new ObjectId().toHexString();
    try {
      await this.collections.appeals.insertOne({
        ...init,
        id,
        student,
        participants,
        openedAt: toISO(DateTime.now()),
        state: "open",
        closedAt: null,
        messages: [],
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AppealAlreadyExistsError(
          init.course,
          init.assignment,
          student,
        );
      }
      throw error;
    }
    return id;
  }

  async getAppealHeadsFromUser(userID: UserID): Promise<AppealHead[]> {
    const appeals = await this.collections.appeals
      .find(
        { participants: userID },
        {
          projection: {
            _id: 0,
            messages: 0,
          },
        },
      )
      .sort({ openedAt: "descending" })
      .toArray();
    return appeals;
  }

  async postMessage(
    userID: UserID,
    appealID: AppealID,
    message: MessageInit,
  ): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      {
        $push: {
          messages: {
            ...message,
            id: new ObjectId().toHexString(),
            from: userID,
            timestamp: toISO(DateTime.now()),
          },
        },
      },
    );
  }
}
