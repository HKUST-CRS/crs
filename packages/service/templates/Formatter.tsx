import type { JSX } from "bun-types/jsx";
import {
  Classes,
  type Request,
  type RequestStatus,
  type ThreadEntry,
  type User,
} from "../models";
import { formatDate, formatDateTime } from "../utils/datetime";

type Metadata = {
  student: User;
  instructors: User[];
  observers: User[];
};

/**
 * Formats the request overview and its opening comment.
 *
 * @example
 * Input: a Swap Section request from Alice for `COMP 1023 L1`.
 * Output: JSX rendering `Alice (alice@example.com) has submitted a Swap
 * Section request ... for class COMP 1023 L1.` followed by the opening reason.
 */
const formatRequestOverview = (
  request: Request,
  metadata: Metadata,
): JSX.Element => {
  if (metadata.student.email !== request.from) {
    throw new Error(
      `Student email ${metadata.student.email} does not match request's from field ${request.from}`,
    );
  }
  const name = metadata.student.name;
  const email = metadata.student.email;
  const type = request.type;
  const clazz = Classes.format(request.class);
  const timestamp = formatDateTime(request.timestamp);
  return (
    <>
      <p>
        {name} (<a href={`mailto:${email}`}>{email}</a>) has submitted a{" "}
        <b>{type}</b> request at {timestamp} for class {clazz}.{" "}
        {formatRequestMetadata(request)}
      </p>
      {formatOpeningComment(request)}
    </>
  );
};

/**
 * Formats the request-specific metadata.
 *
 * @example
 * Input: `{ type: "Swap Section", metadata: { fromSection: "L1",
 * fromDate: "2025-11-25", toSection: "L2", toDate: "2025-11-26" } }`.
 * Output: JSX rendering `The student is requesting to swap from section L1
 * on Nov 25, 2025 to section L2 on Nov 26, 2025.`
 */
const formatRequestMetadata = (request: Request) => {
  switch (request.type) {
    case "Swap Section": {
      const fromDate = formatDate(request.metadata.fromDate);
      const toDate = formatDate(request.metadata.toDate);
      const fromSection = request.metadata.fromSection;
      const toSection = request.metadata.toSection;
      return (
        <>
          The student is requesting to swap from section {fromSection} on{" "}
          {fromDate} to section {toSection} on {toDate}.
        </>
      );
    }
    case "Absent from Section": {
      const fromDate = formatDate(request.metadata.fromDate);
      const fromSection = request.metadata.fromSection;
      return (
        <>
          The student is requesting to be absent from section {fromSection} on{" "}
          {fromDate}.
        </>
      );
    }
    case "Deadline Extension": {
      const assignment = request.metadata.assignment;
      const deadline = formatDateTime(request.metadata.deadline);
      return (
        <>
          The student is requesting a deadline extension for assignment{" "}
          {assignment} to {deadline}.
        </>
      );
    }
  }
};

// The opening comment holds the request's initial reason (+ proofs); it is the
// first entry of the thread.
/**
 * Formats the request's opening comment and proof count.
 *
 * @example
 * Input: a request whose first thread entry is `{ kind: "comment", text:
 * "I need to swap.", proofs: [file] }`.
 * Output: JSX rendering the reason in a blockquote and `The student provided
 * 1 proof document(s) with the request.`
 */
const formatOpeningComment = (request: Request): JSX.Element => {
  const opening = request.thread[0];
  if (!opening || opening.kind !== "comment") {
    return <p>The student did not provide a reason for the request.</p>;
  }
  const proofCount = opening.proofs?.length ?? 0;
  return (
    <>
      <p>The reason for the request is as follows:</p>
      <blockquote>{opening.text}</blockquote>
      {proofCount ? (
        <p>
          The student provided {proofCount} proof document(s) with the request.
        </p>
      ) : (
        <p>The student did not attach any proof documents.</p>
      )}
    </>
  );
};

const STATUS_VERB: Record<RequestStatus, string> = {
  open: "reopened",
  approved: "approved",
  rejected: "rejected",
  appealed: "appealed",
  cancelled: "cancelled",
};

/**
 * Formats a thread entry into a human-readable JSX fragment for update
 * notifications.
 *
 * @example
 * Input: `{ kind: "status", from: "instructor@example.com", status:
 * "approved" }` with that instructor named `Dr. Lee`.
 * Output: JSX rendering `Dr. Lee approved the request.`
 */
export const formatUpdate = (
  entry: ThreadEntry,
  metadata: Metadata,
): JSX.Element => {
  // Resolve the author among the student, instructors, and observers. An
  // observer's comment would otherwise be mislabeled "An instructor".
  const actor =
    entry.from === metadata.student.email
      ? metadata.student
      : (metadata.instructors.find((i) => i.email === entry.from) ??
        metadata.observers?.find((i) => i.email === entry.from));
  const actorName =
    actor?.name ||
    (entry.from === metadata.student.email ? "The student" : "A participant");

  switch (entry.kind) {
    case "comment":
      return (
        <>
          <p>{actorName} added a comment to the request:</p>
          <blockquote>{entry.text}</blockquote>
          {entry.proofs?.length ? (
            <p>There are {entry.proofs.length} document(s) attached.</p>
          ) : null}
        </>
      );
    case "status":
      return (
        <p>
          {actorName} {STATUS_VERB[entry.status]} the request.
        </p>
      );
  }
};

/**
 * Formats a request into a human-readable format as JSX. This can be further
 * transformed into a HTML string used for email notifications or other purposes.
 *
 * @example
 * Input: a Swap Section request from Alice with opening comment `I need to
 * swap.`.
 * Output: JSX rendering the request overview, request details, and opening
 * reason.
 */
export const formatRequest = (
  request: Request,
  metadata: Metadata,
): JSX.Element => {
  return <>{formatRequestOverview(request, metadata)}</>;
};
