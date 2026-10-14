import { expect, test } from "bun:test";
import { Course } from "../models/course";
import { validateAbsentFromSection } from "../models/request/AbsentFromSection";
import { validateDeadlineExtension } from "../models/request/DeadlineExtension";
import { validateExamAppeal } from "../models/request/ExamAppeal";
import { validateExamSpecialArrangement } from "../models/request/ExamSpecialArrangement";
import { validateSwapSection } from "../models/request/SwapSection";

const date = "2026-10-14";
const deadline = "2026-10-15T10:00:00+08:00";
const section = { schedule: [{ day: 3, from: "09:00", to: "10:00" }] };
const assignment = {
  name: "PA1",
  due: "2026-10-14T10:00:00+08:00",
  maxExtension: "PT24H",
};
const question = { grader: "grader@ust.hk" };
const exam = { questions: { Q1: question } };
const course = Course.parse({
  code: "COMP 1023",
  term: "2610",
  title: "Request Validation",
  sections: { L1: section, L2: section },
  assignments: { PA1: assignment },
  exams: { Midterm: exam },
  effectiveRequestTypes: {
    "Swap Section": true,
    "Absent from Section": true,
    "Deadline Extension": true,
    "Exam Appeal": true,
    "Exam Special Arrangement": true,
  },
});
const lookups = [
  {
    name: "Swap from section",
    key: "L1",
    validate: (course: Course, key: string) =>
      validateSwapSection(course, {
        fromSection: key,
        fromDate: date,
        toSection: "L2",
        toDate: date,
      }),
  },
  {
    name: "Swap to section",
    key: "L2",
    validate: (course: Course, key: string) =>
      validateSwapSection(course, {
        fromSection: "L1",
        fromDate: date,
        toSection: key,
        toDate: date,
      }),
  },
  {
    name: "Absent section",
    key: "L1",
    validate: (course: Course, key: string) =>
      validateAbsentFromSection(course, { fromSection: key, fromDate: date }),
  },
  {
    name: "Deadline assignment",
    key: "PA1",
    validate: (course: Course, key: string) =>
      validateDeadlineExtension(course, { assignment: key, deadline }),
  },
  {
    name: "Appeal exam",
    key: "Midterm",
    validate: (course: Course, key: string) =>
      validateExamAppeal(course, { examCode: key, question: "Q1" }),
  },
  {
    name: "Appeal question",
    key: "Q1",
    validate: (course: Course, key: string) =>
      validateExamAppeal(course, { examCode: "Midterm", question: key }),
  },
  {
    name: "Arrangement exam",
    key: "Midterm",
    validate: (course: Course, key: string) =>
      validateExamSpecialArrangement(course, { examCode: key }),
  },
];

test("all request validators accept configured keys", () => {
  expect(
    lookups.map(({ name, key, validate }) => [name, validate(course, key)]),
  ).toEqual(lookups.map(({ name }) => [name, true]));
});

test("all request lookups reject unknown and inherited keys without throwing", () => {
  for (const key of ["unknown", "toString", "constructor", "__proto__"])
    expect(
      lookups.map(({ name, validate }) => [name, validate(course, key)]),
    ).toEqual(lookups.map(({ name }) => [name, false]));
});

test("special names are accepted when they are explicitly configured own keys", () => {
  const special = Course.parse({
    ...course,
    sections: { ...course.sections, toString: section },
    assignments: { ...course.assignments, toString: assignment },
    exams: {
      Midterm: { questions: { Q1: question, toString: question } },
      toString: exam,
    },
  });
  expect(
    lookups.map(({ name, validate }) => [name, validate(special, "toString")]),
  ).toEqual(lookups.map(({ name }) => [name, true]));
});
