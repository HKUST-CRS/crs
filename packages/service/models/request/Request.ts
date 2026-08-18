import Papa from "papaparse";
import { z } from "zod";
import { formatDate, formatDateTime } from "../../utils/datetime";
import { Terms } from "../course";
import { AbsentFromSectionRequest } from "./AbsentFromSection";
import { RequestDetails } from "./BaseRequest";
import { DeadlineExtensionRequest } from "./DeadlineExtension";
import type { RequestStatus } from "./RequestStatus";
import { SwapSectionRequest } from "./SwapSection";
import type { CommentEntry } from "./Thread";

export const RequestInits = [
  SwapSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    status: true,
    updates: true,
  }).extend({ details: RequestDetails }),
  AbsentFromSectionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    status: true,
    updates: true,
  }).extend({ details: RequestDetails }),
  DeadlineExtensionRequest.omit({
    id: true,
    from: true,
    timestamp: true,
    status: true,
    updates: true,
  }).extend({ details: RequestDetails }),
] as const;
export const Requests = [
  SwapSectionRequest,
  AbsentFromSectionRequest,
  DeadlineExtensionRequest,
] as const;
export const RequestHeads = [
  SwapSectionRequest.omit({
    metadata: true,
    updates: true,
  }),
  AbsentFromSectionRequest.omit({
    metadata: true,
    updates: true,
  }),
  DeadlineExtensionRequest.omit({
    metadata: true,
    updates: true,
  }),
] as const;

export const RequestInit = z.discriminatedUnion("type", RequestInits);
export type RequestInit = z.infer<typeof RequestInit>;

export const Request = z.discriminatedUnion("type", Requests);
export type Request = z.infer<typeof Request>;

export const RequestHead = z.discriminatedUnion("type", RequestHeads);
export type RequestHead = z.infer<typeof RequestHead>;

/**
 * The opening comment of a request — its initial reason (+ proof), recorded as
 * the first thread entry at creation time.
 */
export function initialComment(
  r: Pick<Request, "updates">,
): CommentEntry | undefined {
  return r.updates.find((e): e is CommentEntry => e.kind === "comment");
}

/**
 * The human-readable decision implied by a status: "Approve" / "Reject" for
 * decided requests, "Pending" otherwise (including appealed, which awaits a
 * re-decision).
 */
export function decisionLabel(
  status: RequestStatus,
): "Approve" | "Reject" | "Pending" {
  if (status === "approved") return "Approve";
  if (status === "rejected") return "Reject";
  return "Pending";
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

    // Swap Section & Absent from Section
    "From Section",
    "From Date",
    "To Section",
    "To Date",
    // Deadline Extension
    "Assignment",
    "New Deadline",

    // Decision
    "Decision",

    // Text
    "Reason",
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
      Status: r.status,
      ...serializeMeta(r),
      Decision: decisionLabel(r.status),
      Reference: `${base}/request/${r.id}`,
      Reason: initialComment(r)?.text ?? "",
    }));
    return Papa.unparse(data, {
      columns: COLUMNS,
      escapeFormulae: true,
    });
  }
}
