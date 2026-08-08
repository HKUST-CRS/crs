import { z } from "zod";
import { CourseID } from "./course";
import { UserID } from "./user";

export const AppealID = z.string().meta({
  description:
    "The unique identifier for the appeal. " +
    "In the current implementation, this is the automatically generated MongoDB ObjectID.",
});
export type AppealID = z.infer<typeof AppealID>;

export const AppealMessage = z
  .object({
    id: AppealID,
    from: UserID,
    timestamp: z.iso.datetime({ offset: true }),
    content: z
      .string()
      .nonempty("The content of the appeal message cannot be empty.")
      .meta({
        description: "The content of the appeal message.",
      }),
  })
  .meta({
    description: "A message in an appeal thread.",
  });
export type AppealMessage = z.infer<typeof AppealMessage>;

export const MessageInit = AppealMessage.omit({
  id: true,
  from: true,
  timestamp: true,
});
export type MessageInit = z.infer<typeof MessageInit>;

export const AppealInit = z.object({
  course: CourseID,
  assignment: z.string().meta({
    description: "The assignment code, acting as the ID for the assignment.",
  }),
});

export type AppealInit = z.infer<typeof AppealInit>;

export const Appeal = z
  .object({
    id: AppealID,
    course: CourseID,
    assignment: z.string(),
    student: UserID,
    participants: z.array(UserID).meta({
      description:
        "The email addresses of the participants in the appeal thread.",
    }),
    openedAt: z.iso.datetime({ offset: true }).meta({
      description: "The timestamp when the appeal was opened.",
    }),
    closedAt: z.union([z.iso.datetime({ offset: true }), z.null()]).meta({
      description:
        "The timestamp when the appeal was closed, or null if it is still open.",
    }),
    state: z.enum(["open", "closed"]).meta({
      description: "The current state of the appeal.",
    }),
    messages: z.array(AppealMessage).meta({
      description: "The messages in the appeal thread.",
    }),
  })
  .meta({
    description: "An appeal for an assignment in a course.",
  });

export type Appeal = z.infer<typeof Appeal>;

export const AppealHead = Appeal.omit({ messages: true });
export type AppealHead = z.infer<typeof AppealHead>;
