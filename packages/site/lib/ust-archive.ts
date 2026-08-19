// biome-ignore-all lint/suspicious/noExplicitAny: The archive schema is intentionally unvalidated.
// ponytail: keep the fragile external row boundary small and lazy-loaded.
import { asyncBufferFromUrl, parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import type { Course } from "service/models";

const SCHEDULE_DATASET =
  "https://huggingface.co/datasets/ust-archive/schedule/resolve/refs%2Fconvert%2Fparquet";
const coursesUrl = `${SCHEDULE_DATASET}/courses/train/0000.parquet`;
const classesUrl = `${SCHEDULE_DATASET}/classes/train/0000.parquet`;
const weekdays = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const compareSections = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true });

export type ImportedCourse = {
  course: Course;
  instructors: Array<{ name: string; sections: string[] }>;
};

let coursesPromise: Promise<any[]> | undefined;

function readParquet(url: string) {
  return asyncBufferFromUrl({ url }).then((file) =>
    parquetReadObjects({ file, compressors }),
  );
}

function readCourses() {
  coursesPromise ??= readParquet(coursesUrl);
  return coursesPromise;
}

function latestActive(rows: any[], key: (row: any) => string) {
  const latest = new Map<string, any>();
  for (const row of rows) {
    const id = key(row);
    const previous = latest.get(id);
    if (!previous || row.timestamp > previous.timestamp) latest.set(id, row);
  }
  return [...latest.values()].filter((row) => row.status === "ACTIVE");
}

const codeOf = (row: any) => `${row.prefix} ${row.number}`;

export function normalizeInstructorName(name: string): string {
  return name
    .replace(/^([^,]+),\s*(.*)$/, "$2 $1")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function timeOf(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null;
  }
  const minutes = Math.floor(Number(value) / 60_000_000);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 1_440) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function parseCourse(
  courseRows: any[],
  classRows: any[],
  term: string,
  code: string,
): ImportedCourse {
  const requestedCode = code.trim().toUpperCase();
  const archiveCourse = latestActive(
    courseRows,
    (row) => `${row.term_code}:${row.id ?? codeOf(row)}`,
  ).find(
    (row) =>
      row.term_code === term &&
      row.id &&
      codeOf(row).toUpperCase() === requestedCode,
  );
  if (!archiveCourse) {
    throw new Error(`Course ${code} is not available in term ${term}`);
  }

  const sections: Course["sections"] = {};
  const instructors = new Map<
    string,
    { name: string; sections: Set<string> }
  >();
  const rows = latestActive(
    classRows,
    (row) => `${row.term_code}:${row.course_id}:${row.section}`,
  )
    .filter(
      (row) =>
        row.term_code === term &&
        String(row.course_id) === String(archiveCourse.id),
    )
    .sort((a, b) => compareSections(String(a.section), String(b.section)));

  for (const row of rows) {
    const sectionName = String(row.section);
    const schedule: Course["sections"][string]["schedule"] = [];
    const seen = new Set<string>();
    for (const entry of row.schedules ?? []) {
      const day = weekdays.indexOf(entry.weekday ?? "");
      const from = timeOf(entry.time_from);
      const to = timeOf(entry.time_to);
      const slot = `${day}:${from}:${to}`;
      if (day > 0 && from && to && !seen.has(slot)) {
        seen.add(slot);
        schedule.push({ day, from, to });
      }

      for (const rawName of entry.instructors ?? []) {
        if (typeof rawName !== "string") continue;
        const name = rawName.trim();
        const normalized = normalizeInstructorName(name);
        if (!normalized || normalized === "tba") continue;
        const instructor = instructors.get(normalized) ?? {
          name,
          sections: new Set<string>(),
        };
        instructor.sections.add(sectionName);
        instructors.set(normalized, instructor);
      }
    }
    schedule.sort((a, b) => a.day - b.day || a.from.localeCompare(b.from));
    sections[sectionName] = { schedule };
  }

  return {
    course: {
      code: codeOf(archiveCourse),
      term,
      title: archiveCourse.title,
      sections,
      assignments: {},
      effectiveRequestTypes: {
        "Swap Section": true,
        "Absent from Section": true,
        "Deadline Extension": true,
        "Assignment Appeal": true,
      },
    },
    instructors: [...instructors.values()]
      .map((instructor) => ({
        name: instructor.name,
        sections: [...instructor.sections].sort(compareSections),
      }))
      .sort(
        (a, b) =>
          compareSections(a.sections.join("\0"), b.sections.join("\0")) ||
          a.name.localeCompare(b.name),
      ),
  };
}

export async function loadCourse(term: string, code: string) {
  const [courses, classes] = await Promise.all([
    readCourses(),
    readParquet(classesUrl),
  ]);
  return parseCourse(courses, classes, term, code);
}
