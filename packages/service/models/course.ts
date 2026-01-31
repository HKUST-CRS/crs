import { z } from "zod";
import { compareString } from "../utils/comparison";
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

export namespace Terms {
  export function formatTerm(term: string) {
    const y1 = term.substring(0, 2);
    const y2 = (parseInt(y1, 10) + 1).toString().padStart(2, "0");
    const semester = {
      "10": "Fall",
      "20": "Winter",
      "30": "Spring",
      "40": "Summer",
    }[term.substring(2, 4)];
    return `${y1}-${y2} ${semester}`;
  }
  export function term2num(term: string): number {
    const y = parseInt(term.substring(0, 2), 10);
    const s = parseInt(term.substring(2, 4), 10);
    if (!(s === 10 || s === 20 || s === 30 || s === 40)) {
      throw new Error(`Invalid term format: ${term}`);
    }
    return y * 4 + (s / 10 - 1);
  }
  export function num2term(num: number): string {
    const y = Math.floor(num / 4);
    const s = ((num % 4) + 1) * 10;
    return `${y.toString().padStart(2, "0")}${s.toString().padStart(2, "0")}`;
  }
  /**
   * The approximate current term from the current date.
   *
   * In this approximation, Sep to Dec is Fall, Jan is Winter, Feb to May is Spring, and Jun to Aug
   * is Summer.
   */
  export function currentTermApprox(): string {
    const now = new Date();
    const yy = now.getFullYear() % 100;
    const mm = now.getMonth();
    const [y, s] = (() => {
      switch (mm) {
        // Jan
        case 0:
          // Winter
          return [yy - 1, 20];

        // Feb to May
        case 1:
        case 2:
        case 3:
        case 4:
          // Spring
          return [yy - 1, 30];

        // Jun to Aug
        case 5:
        case 6:
        case 7:
          // Summer
          return [yy - 1, 40];

        // Sep to Dec
        case 8:
        case 9:
        case 10:
        case 11:
          // Fall
          return [yy, 10];
        default:
          throw new Error(`Unreachable month value: ${mm}`);
      }
    })();
    return `${y.toString().padStart(2, "0")}${s.toString().padStart(2, "0")}`;
  }
}

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

  export function formatID(cid: CourseId): string {
    return `${cid.code} (${Terms.formatTerm(cid.term)})`;
  }

  export function formatCourse(course: Course): string {
    return `${course.code} (${Terms.formatTerm(course.term)})`;
  }

  export function toID(course: Course): CourseId {
    return {
      code: course.code,
      term: course.term,
    };
  }

  export function compare(a: CourseId, b: CourseId): number {
    return compareString(Courses.id2str(a), Courses.id2str(b));
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
  export function format(clazz: Class): string {
    return `${Courses.formatID(clazz.course)} ${clazz.section}`;
  }
}
