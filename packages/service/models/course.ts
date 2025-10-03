import { z } from "zod";
import { RequestType } from "./request/RequestType";

export const Course = z
  .object({
    code: z.string().meta({
      description: "The course code.",
      examples: ["COMP 1023"],
    }),
    term: z.string().meta({
      description:
        "The code of the academic term the course is offered in." +
        "The first 2 digits represent the academic year, e.g., 25 for academic year 2025-26." +
        "The last 2 digits represent the semester. 10 for Fall, 20 for Winter, 30 for Spring, and 40 for Summer." +
        "For example, 2510 represents academic year 2025-26 Fall.",
      examples: ["2510"],
    }),
    title: z.string().meta({ description: "The title of the course." }),
    sections: z.record(
      z.string().meta({
        description: "The section code.",
        examples: ["L1", "L01", "T1", "LA1"],
      }),
      z.object({
        schedule: z.array(
          z.object({
            day: z.number().min(1).max(7),
            from: z.iso.time(),
            to: z.iso.time(),
          }),
        ),
      }),
    ),
    assignments: z.record(
      z.string().meta({
        description:
          "The assignment code, acting as the ID for the assignment.",
        examples: ["Lab1", "PA1"],
      }),
      z.object({
        name: z.string().meta({ description: "The name of the assignment." }),
        due: z.iso.datetime({ offset: true }).meta({
          description: "The due date of the assignment.",
        }),
        maxExtension: z.iso.duration().meta({
          description:
            "The maximum extension duration allowed for this assignment.",
        }),
      }),
    ),
    effectiveRequestTypes: z.record(RequestType, z.boolean()).meta({
      description:
        "A mapping of request types that are effective for this course.",
    }),
  })
  .meta({
    description: "An *offering* of a course in a specific term.",
  });

export const CourseId = Course.pick({ code: true, term: true });

export type Course = z.infer<typeof Course>;
export type CourseId = z.infer<typeof CourseId>;

export namespace Courses {
  export function id2str(courseId: CourseId): string {
    return `${courseId.code} @ ${courseId.term}`;
  }
  export function str2id(courseIdStr: string): CourseId {
    const [code, term] = courseIdStr.split(" @ ");
    if (code && term) {
      return {
        code,
        term,
      };
    } else {
      throw new Error(`Illegal course ID string: ${courseIdStr}`);
    }
  }
}

export const SectionId = z.string().meta({
  description: "The section code.",
  examples: ["L1", "L01", "T1", "LA1"],
});

export const Class = z
  .object({
    course: CourseId,
    section: SectionId,
  })
  .meta({
    description:
      "A (so-called) class, representing a specific section of a course.",
  });

export type Class = z.infer<typeof Class>;

export namespace Classes {
  export function id2str(clazz: Class): string {
    return `${Courses.id2str(clazz.course)} - ${clazz.section}`;
  }
  export function str2id(classStr: string): Class {
    const [courseStr, section] = classStr.split(" - ");
    if (courseStr && section) {
      return {
        course: Courses.str2id(courseStr),
        section,
      };
    } else {
      throw new Error(`Illegal class string: ${classStr}`);
    }
  }
}
