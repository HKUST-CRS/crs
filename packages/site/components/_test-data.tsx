import type { Course, CourseId, Request, User } from "service/models";

export const Requests: Request[] = [
  {
    id: "1",
    type: "Swap Section",
    course: {
      code: "COMP 1023",
      term: "2510",
    },
    from: "yhliaf@connect.ust.hk",
    details: {
      reason: "Clash with another course",
      proof: [],
    },
    metadata: {
      fromSection: "L1",
      toSection: "L1",
      fromDate: "2024-09-01",
      toDate: "2024-12-15",
    },
    response: null,
    timestamp: "2025-09-20T10:00:00+08:00",
  },
  {
    id: "2",
    type: "Swap Section",
    course: {
      code: "COMP 1023",
      term: "2510",
    },
    from: "yhliaf@connect.ust.hk",
    details: {
      reason: "Clash with another course",
      proof: [],
    },
    metadata: {
      fromSection: "L1",
      toSection: "L1",
      fromDate: "2024-09-02",
      toDate: "2024-12-16",
    },
    response: {
      decision: "Approve",
      from: "desmond@ust.hk",
      remarks:
        "Approved. Please contact the instructor of the new section for further arrangement.",
      timestamp: "2025-09-21T10:00:00+08:00",
    },
    timestamp: "2025-09-20T10:25:00+08:00",
  },
  {
    id: "3",
    type: "Deadline Extension",
    course: {
      code: "COMP 1023",
      term: "2510",
    },
    from: "yhliaf@connect.ust.hk",
    details: {
      reason: "Clash with another course",
      proof: [],
    },
    metadata: {
      assignment: "Lab1",
      deadline: "2024-09-26T23:59:00.000+08:00",
    },
    response: null,
    timestamp: "2025-09-20T11:00:00+08:00",
  },
];

export const Users: User[] = [
  {
    email: "yhliaf@connect.ust.hk",
    name: "Harry Li",
    enrollment: [
      { code: "COMP 1023", term: "2510", role: "student", sections: ["L2"] },
      { code: "COMP 2211", term: "2510", role: "student", sections: ["L1"] },
    ],
  },
  {
    email: "desmond@ust.hk",
    name: "Dr. Desmond TSOI",
    enrollment: [
      { code: "COMP 1023", term: "2510", role: "instructor", sections: ["L1"] },
      { code: "COMP 2211", term: "2510", role: "instructor", sections: ["L1"] },
    ],
  },
  {
    email: "huiruxiao@ust.hk",
    name: "XIAO Huiru",
    enrollment: [
      { code: "COMP 1023", term: "2510", role: "instructor", sections: ["L2"] },
    ],
  },
];

export const Courses: Course[] = [
  {
    code: "COMP 1023",
    term: "2510",
    title: "Introduction to Python Programming",
    effectiveRequestTypes: {
      "Swap Section": true,
      "Deadline Extension": true,
    },
    sections: [
      {
        code: "L1",
        schedule: [
          { day: 1, from: "10:30", to: "12:00" },
          { day: 3, from: "10:30", to: "12:00" },
        ],
      },
    ],
    assignments: [
      {
        code: "Lab1",
        name: "Python Basics",
        due: "2025-09-25T23:59:00.000+08:00",
        maxExtension: "P3D",
      },
    ],
  },
  {
    code: "COMP 2211",
    term: "2510",
    title: "Exploring Artificial Intelligence",
    effectiveRequestTypes: {
      "Swap Section": true,
      "Deadline Extension": true,
    },
    sections: [],
    assignments: [],
  },
];

export const currentUser = Users[0];

export function findCourse(code: { code: string }): Course | undefined {
  return Courses.find((c) => c.code === code.code);
}

export function findInstructors(course: CourseId) {
  return Users.filter((u) => {
    const enrollment = u.enrollment.find((e) => {
      return e.code === course.code && e.term === course.term;
    });
    return enrollment?.role === "instructor";
  });
}

export function findSection(course: Course, sectionCode: string) {
  return course.sections.find((s) => s.code === sectionCode);
}

export function findAssignment(course: Course, assignmentCode: string) {
  return course.assignments?.find((a) => a.code === assignmentCode);
}

export function findRequest(id: string) {
  return Requests.find((r) => r.id === id);
}
