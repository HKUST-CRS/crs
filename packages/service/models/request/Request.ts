import Papa from "papaparse";
import { z } from "zod";
import { formatDate, formatDateTime } from "../../utils/datetime";
import { Terms } from "../course";
import { AbsentFromSectionRequest } from "./AbsentFromSection";
import { DeadlineExtensionRequest } from "./DeadlineExtension";
import { SwapSectionRequest } from "./SwapSection";

export const RequestInits = [
  SwapSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    response: true,
  }),
  AbsentFromSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    response: true,
  }),
  DeadlineExtensionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    response: true,
  }),
] as const;
export const Requests = [
  SwapSectionRequest,
  AbsentFromSectionRequest,
  DeadlineExtensionRequest,
] as const;

export const Request = z.discriminatedUnion("type", Requests);
export type Request = z.infer<typeof Request>;

export const RequestInit = z.discriminatedUnion("type", RequestInits);
export type RequestInit = z.infer<typeof RequestInit>;

export namespace RequestSerialization {
  const COLUMNS = [
    // Request
    "ID",
    "Reference",
    "Course Code",
    "Course Term",
    "Section",
    "User",
    "Type",
    "Timestamp",

    // Swap Section & Absent from Section
    "From Section",
    "From Date",
    "To Section",
    "To Date",
    // Deadline Extension
    "Assignment",
    "New Deadline",

    // Response
    "Decision",

    // Text
    "Reason",
    "Remarks",
  ];

  function serializeMeta(r: Request) {
    switch (r.type) {
      case "Swap Section":
        return {
          "From Section": r.metadata.fromSection,
          "From Date": formatDate(r.metadata.fromDate),
          "To Section": r.metadata.toSection,
          "To Date": formatDate(r.metadata.toDate),
        };
      case "Absent from Section":
        return {
          "From Section": r.metadata.fromSection,
          "From Date": formatDate(r.metadata.fromDate),
        };
      case "Deadline Extension":
        return {
          Assignment: r.metadata.assignment,
          "New Deadline": formatDateTime(r.metadata.deadline),
        };
    }
  }

  export function toCSV(requests: Request[], base: string): string {
    const data = requests.map((r) => ({
      ID: r.id,
      "Course Code": r.class.course.code,
      "Course Term": Terms.formatTerm(r.class.course.term),
      Section: r.class.section,
      User: r.from,
      Type: r.type,
      Timestamp: formatDateTime(r.timestamp),
      ...serializeMeta(r),
      Decision: r.response?.decision ?? "Pending",
      Reference: `${base}/request/${r.id}`,
      Reason: r.details.reason,
      Remarks: r.response?.remarks ?? "",
    }));
    return Papa.unparse(data, {
      columns: COLUMNS,
      escapeFormulae: true,
    });
  }
}
