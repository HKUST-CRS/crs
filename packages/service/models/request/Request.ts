import Papa from "papaparse";
import { z } from "zod";
import { formatDate, formatDateTime } from "../../utils/datetime";
import { Terms } from "../course";
import { AbsentFromSectionRequest } from "./AbsentFromSection";
import { DeadlineExtensionRequest } from "./DeadlineExtension";
import type { RequestStatus } from "./RequestStatus";
import { SwapSectionRequest } from "./SwapSection";

export const RequestInits = [
  SwapSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    thread: true,
    status: true,
  }),
  AbsentFromSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    thread: true,
    status: true,
  }),
  DeadlineExtensionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    thread: true,
    status: true,
  }),
] as const;
export const Requests = [
  SwapSectionRequest,
  AbsentFromSectionRequest,
  DeadlineExtensionRequest,
] as const;
export const RequestInit = z.discriminatedUnion("type", RequestInits);
export type RequestInit = z.infer<typeof RequestInit>;

export const Request = z.discriminatedUnion("type", Requests);
export type Request = z.infer<typeof Request>;

/** The request shape persisted in MongoDB; status is derived when read. */
export const RequestDocument = z.discriminatedUnion("type", [
  SwapSectionRequest.omit({ status: true }),
  AbsentFromSectionRequest.omit({ status: true }),
  DeadlineExtensionRequest.omit({ status: true }),
] as const);
export type RequestDocument = z.infer<typeof RequestDocument>;

/**
 * The human-readable decision implied by a status: "Approve" / "Reject" for
 * decided requests, "Appealed" for requests awaiting a re-decision, and
 * "Cancelled" for withdrawn requests. "Pending" is used for open requests.
 */
export function decisionLabel(
  status: RequestStatus,
): "Approve" | "Reject" | "Pending" | "Appealed" | "Cancelled" {
  switch (status) {
    case "approved":
      return "Approve";
    case "rejected":
      return "Reject";
    case "appealed":
      return "Appealed";
    case "cancelled":
      return "Cancelled";
    case "open":
      return "Pending";
  }
}

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
    "Status",

    // Decision
    "Decision",

    // Swap Section & Absent from Section
    "From Section",
    "From Date",
    "To Section",
    "To Date",
    // Deadline Extension
    "Assignment",
    "New Deadline",
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
      Reference: `${base}/request/${r.id}`,
      "Course Code": r.class.course.code,
      "Course Term": Terms.formatTerm(r.class.course.term),
      Section: r.class.section,
      User: r.from,
      Type: r.type,
      Timestamp: formatDateTime(r.timestamp),
      Status: r.status,

      Decision: decisionLabel(r.status),

      ...serializeMeta(r),
    }));
    return Papa.unparse(data, {
      columns: COLUMNS,
      escapeFormulae: true,
    });
  }
}
