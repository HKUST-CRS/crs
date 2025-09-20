import type { Course, CourseId, User } from "service/models";

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
