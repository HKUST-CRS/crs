import { z } from "zod";
import { CourseID } from "./course";
import { UserID } from "./user";

/**
 * The role a participant holds in an appeal.
 *
 * Extends the system `Role` (student/instructor/observer/admin) with the two
 * appeal-specific categories: `ta` (a TA of the appealed assignment, who has
 * no distinct system role) and `lecturer` (a lecturer of the student's lecture
 * section who holds no course enrollment).
 */
export const AppealRole = z.enum([
  "admin",
  "instructor",
  "observer",
  "student",
  "ta",
  "lecturer",
]);
export type AppealRole = z.infer<typeof AppealRole>;

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
    kind: z
      .enum(["system"])
      .optional()
      .meta({
        description:
          "Marks the message as a system record rather than a user post. " +
          "Absent for regular chat messages.",
      }),
    from: UserID,
    role: AppealRole.optional().meta({
      description:
        "The sender's role in the appeal at the time the message was posted. " +
        "Stored (frozen) at post time: the appealing student, a TA of the " +
        "assignment, or a lecturer.",
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
  kind: true,
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
    closeRequest: z
      .object({
        result: z.string().nonempty("The appeal result cannot be empty.").meta({
          description: "The proposed resolution of the appeal.",
        }),
        requestedBy: UserID,
        requestedAt: z.iso.datetime({ offset: true }),
      })
      .nullable()
      .optional()
      .meta({
        description:
          "A pending request to close the appeal with an agreed result. " +
          "Absent or null when no close has been requested; retained after " +
          "closing so the final result is preserved.",
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

export const AppealParticipant = z.object({
  email: UserID,
  name: z.string().meta({
    description: "The participant's display name, or their email if unknown.",
  }),
  role: AppealRole.meta({
    description:
      "The participant's role in the appeal: the appealing student, a TA " +
      "of the assignment, or a lecturer.",
  }),
});
export type AppealParticipant = z.infer<typeof AppealParticipant>;
