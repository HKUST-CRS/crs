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
  },
  {
    code: "COMP 2211",
    term: "2510",
    title: "Exploring Artificial Intelligence",
    effectiveRequestTypes: {
      "Swap Section": true,
      "Deadline Extension": true,
    },
  },
];

export const currentUser = Users[0];

export function findCourse(code: { code: string }): Course | undefined {
  return Courses.find((c) => c.code === code.code);
}

export function findInstructors(course: CourseId) {
  console.log("Finding instructors for", course, "in", Users);
  return Users.filter((u) => {
    const enrollment = u.enrollment.find((e) => {
      return e.code === course.code && e.term === course.term;
    });
    console.log("  Checking user", u.email, "enrollment", enrollment);
    return enrollment?.role === "instructor";
  });
}
