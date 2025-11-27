/** Note: modifying test data may affect multiple tests */
/** Users and courses are created by testDb automatically, while requests are not */

import type { Course, RequestInit, ResponseInit, User } from "../models";

export const students: [User, User, User] = [
  {
    email: "student1@connect.ust.hk",
    name: "student1",
    enrollment: [
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "L1",
      },
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "LA1",
      },
    ],
  },
  {
    email: "student2@connect.ust.hk",
    name: "student2",
    enrollment: [
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "L2",
      },
      {
        role: "student",
        course: { code: "COMP 1023", term: "2510" },
        section: "LA2",
      },
    ],
  },
  {
    email: "student3@connect.ust.hk",
    name: "student3",
    enrollment: [
      {
        role: "student",
        course: { code: "COMP 1023", term: "2530" },
        section: "L1",
      },
    ],
  },
];

export const tas: [User] = [
  {
    email: "ta1@connect.ust.hk",
    name: "ta1",
    enrollment: [
      {
        role: "ta",
        course: { code: "COMP 1023", term: "2510" },
        section: "L1",
      },
      {
        role: "ta",
        course: { code: "COMP 1023", term: "2510" },
        section: "LA1",
      },
      {
        role: "student",
        course: { code: "COMP 4971H", term: "2510" },
        section: "R1",
      },
    ],
  },
];

export const instructors: [User, User] = [
  {
    email: "instructor1@ust.hk",
    name: "instructor1",
    enrollment: [
      {
        role: "instructor",
        course: { code: "COMP 1023", term: "2510" },
        section: "L1",
      },
      {
        role: "instructor",
        course: { code: "COMP 1023", term: "2510" },
        section: "LA1",
      },
    ],
  },
  {
    email: "instructor2@ust.hk",
    name: "instructor2",
    enrollment: [
      {
        role: "instructor",
        course: { code: "COMP 4971H", term: "2510" },
        section: "R1",
      },
    ],
  },
];

export const courses: [Course, Course, Course] = [
  {
    code: "COMP 1023",
    term: "2510",
    title: "Python",
    sections: {
      L1: {
        schedule: [],
      },
      L2: {
        schedule: [],
      },
      LA1: {
        schedule: [],
      },
      LA2: {
        schedule: [],
      },
    },
    assignments: {},
    effectiveRequestTypes: {
      "Swap Section": true,
      "Deadline Extension": true,
    },
  },
  {
    code: "COMP 1023",
    term: "2530",
    title: "Python",
    sections: {
      L1: {
        schedule: [],
      },
    },
    assignments: {},
    effectiveRequestTypes: {
      "Swap Section": true,
      "Deadline Extension": true,
    },
  },
  {
    code: "COMP 4971H",
    term: "2510",
    title: "Independent Work",
    sections: {
      R1: {
        schedule: [],
      },
    },
    assignments: {},
    effectiveRequestTypes: {
      "Swap Section": false,
      "Deadline Extension": true,
    },
  },
];

export const requestInit: RequestInit = {
  type: "Swap Section",
  class: { course: { code: "COMP 1023", term: "2510" }, section: "L1" },
  details: {
    reason: "",
    proof: [],
  },
  metadata: {
    fromSection: "L1",
    fromDate: "2025-11-25",
    toSection: "L2",
    toDate: "2025-11-26",
  },
};

export const responseInit: ResponseInit = {
  decision: "Approve",
  remarks: "^^",
};
