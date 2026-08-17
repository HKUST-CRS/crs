import { z } from "zod";
import { CourseID } from "./course";
import { Role, UserID } from "./user";

export const AppealID = z.string().meta({
  description:
    "The unique identifier for the appeal. " +
    "In the current implementation, this is the automatically generated MongoDB ObjectID.",
});
export type AppealID = z.infer<typeof AppealID>;

export const AppealAttachment = z
  .object({
    name: z.string().meta({ description: "The name of the file." }),
    size: z
      .number()
      .meta({ description: "The size of the file in bytes." })
      .max(2 * 1024 * 1024, "At most 2 MiB per file is allowed."),
    content: z.base64().meta({
      description: "The base64-encoded content of the file.",
    }),
  })
  .meta({ description: "A file attached to an appeal message." });
export type AppealAttachment = z.infer<typeof AppealAttachment>;

export const AppealAttachmentAccept = [
  "image/*",
  "application/pdf",
  "text/plain",
];

export const AppealMessage = z
  .object({
    id: AppealID,
    from: UserID,
    role: Role.optional().meta({
      description:
        "The sender's role in the appeal's course at the time the message was posted. " +
        "Stored (frozen) at post time; absent if the " +
        "sender has no enrollment in the course.",
    }),
    timestamp: z.iso.datetime({ offset: true }),
    content: z
      .string()
      .nonempty("The content of the appeal message cannot be empty.")
      .meta({
        description: "The content of the appeal message.",
      }),
    attachments: z
      .array(AppealAttachment)
      .max(4, "At most 4 files per message are allowed.")
      .optional()
      .meta({
        description: "Optional files attached to the message.",
      }),
  })
  .meta({
    description: "A message in an appeal thread.",
  });
export type AppealMessage = z.infer<typeof AppealMessage>;

export const MessageInit = AppealMessage.omit({
  id: true,
  from: true,
  role: true,
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
