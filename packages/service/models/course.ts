import { z } from "zod";
import { UserId, CourseId } from "./util";
import { RequestType } from "./request";

const PeopleType = z.literal(["student", "instructor", "ta"]);

export const Course = z.object({
  id: CourseId,
  title: z.string(),
  people: z.record(UserId, PeopleType),
  requestTypesEnabled: z.record(RequestType, z.boolean()),
});
