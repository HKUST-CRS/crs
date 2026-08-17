import { DateTime } from "luxon";
import { MongoServerError, ObjectId } from "mongodb";
import type { Collections } from "../db";
import type {
  Appeal,
  AppealHead,
  AppealID,
  AppealInit,
  AppealRole,
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
        closeRequest: null,
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
    role?: AppealRole,
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
            // `role` is undefined for participants with no course enrollment;
            // skip it so Mongo never stores an undefined field.
            ...(role ? { role } : {}),
          },
        },
      },
    );
  }

  /**
   * Appends a system message to the thread, used to keep a record of events
   * such as the student agreeing to or declining a close request.
   *
   * @param appealID The ID of the appeal.
   * @param from The email of the user the record is about.
   * @param content The record text.
   */
  async postSystemMessage(
    appealID: AppealID,
    from: UserID,
    content: string,
  ): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      {
        $push: {
          messages: {
            id: new ObjectId().toHexString(),
            kind: "system",
            from,
            timestamp: toISO(DateTime.now()),
            content,
          },
        },
      },
    );
  }

  /**
   * Add a user to the participants of an appeal.
   *
   * `$addToSet` makes the operation idempotent: a user who is already a
   * participant is left unchanged.
   */
  async addParticipant(appealID: AppealID, userID: UserID): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      { $addToSet: { participants: userID } },
    );
  }

  /**
   * Records a pending request to close the appeal with the given result.
   *
   * The appeal stays open until the student agrees.
   */
  async requestClose(
    appealID: AppealID,
    result: string,
    requestedBy: UserID,
  ): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      {
        $set: {
          closeRequest: {
            result,
            requestedBy,
            requestedAt: toISO(DateTime.now()),
          },
        },
      },
    );
  }

  /**
   * Closes the appeal.
   *
   * `closeRequest` is left in place so the agreed result is preserved on the
   * closed appeal.
   */
  async closeAppeal(appealID: AppealID): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      {
        $set: {
          state: "closed",
          closedAt: toISO(DateTime.now()),
        },
      },
    );
  }

  /**
   * Clears a pending close request, keeping the appeal open so the discussion
   * can continue.
   */
  async declineClose(appealID: AppealID): Promise<void> {
    await this.collections.appeals.updateOne(
      { id: appealID },
      { $set: { closeRequest: null } },
    );
  }
}
