import { describe, expect, test } from "bun:test";
import { normalizeInstructorName, parseCourse } from "./ust-archive";

const micros = (hours: number, minutes = 0) =>
  BigInt((hours * 60 + minutes) * 60_000_000);

const courses = [
  {
    term_code: "2510",
    id: "course-1",
    prefix: "COMP",
    number: "2011",
    title: "Old title",
    status: "ACTIVE",
    timestamp: "2025-01-01T00:00:00Z",
  },
  {
    term_code: "2510",
    id: "course-1",
    prefix: "COMP",
    number: "2011",
    title: "Programming Fundamentals",
    status: "ACTIVE",
    timestamp: "2025-02-01T00:00:00Z",
  },
  {
    term_code: "2510",
    id: "course-2",
    prefix: "COMP",
    number: "3000",
    title: "Withdrawn",
    status: "ACTIVE",
    timestamp: "2025-01-01T00:00:00Z",
  },
  {
    term_code: "2510",
    id: "course-2",
    prefix: "COMP",
    number: "3000",
    title: "Withdrawn",
    status: "INACTIVE",
    timestamp: "2025-02-01T00:00:00Z",
  },
];

describe("schedule browser adapter", () => {
  test("normalizes archive instructor names", () => {
    expect(normalizeInstructorName("Müller, Björn")).toBe("bjorn muller");
    expect(normalizeInstructorName("  Jane   DOE ")).toBe("jane doe");
  });

  test("builds CRS course data", () => {
    expect(
      parseCourse(
        courses,
        [
          {
            term_code: "2510",
            course_id: "course-1",
            section: "L10",
            schedules: [
              {
                weekday: "Tue",
                time_from: micros(8),
                time_to: micros(9),
                instructors: ["DOE, Jane", "Smith, Alex"],
              },
            ],
            status: "ACTIVE",
            timestamp: "2025-02-01T00:00:00Z",
          },
          {
            term_code: "2510",
            course_id: "course-1",
            section: "L2",
            schedules: [
              {
                weekday: "Wed",
                time_from: micros(10),
                time_to: micros(11),
                instructors: ["DOE, Jane"],
              },
            ],
            status: "ACTIVE",
            timestamp: "2025-02-01T00:00:00Z",
          },
        ],
        "2510",
        "comp 2011",
      ),
    ).toEqual({
      course: {
        code: "COMP 2011",
        term: "2510",
        title: "Programming Fundamentals",
        sections: {
          L2: { schedule: [{ day: 3, from: "10:00", to: "11:00" }] },
          L10: { schedule: [{ day: 2, from: "08:00", to: "09:00" }] },
        },
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
          "Deadline Extension": true,
        },
      },
      instructors: [
        { name: "DOE, Jane", sections: ["L2", "L10"] },
        { name: "Smith, Alex", sections: ["L10"] },
      ],
    });
  });
});
