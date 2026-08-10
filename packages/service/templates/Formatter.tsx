import type { JSX } from "bun-types/jsx";
import {
  Classes,
  initialComment,
  type Request,
  type RequestStatus,
  type ThreadEntry,
  type User,
} from "../models";
import { formatDate, formatDateTime } from "../utils/datetime";

type Metadata = {
  student: User;
  instructors: User[];
  /**
   * Observers in the class. Only needed by {@link formatUpdate} to attribute
   * an update authored by an observer; other formatters ignore this field.
   */
  observers?: User[];
};

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

// The opening comment holds the request's initial reason (+ proof); it is the
// first entry of the thread. Legacy documents get a synthesized opening on read.
const formatOpeningComment = (request: Request): JSX.Element => {
  const opening = initialComment(request);
  if (!opening) {
    return <p>The student did not provide a reason for the request.</p>;
  }
  const proofCount = opening.proof?.length ?? 0;
  return (
    <>
      <p>The reason for the request is as follows:</p>
      <blockquote>{opening.text}</blockquote>
      {proofCount ? (
        <p>
          There are {proofCount} proof document(s) for the request attached.
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
          {entry.proof?.length ? (
            <p>There are {entry.proof.length} document(s) attached.</p>
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
 */
export const formatRequest = (
  request: Request,
  metadata: Metadata,
): JSX.Element => {
  return <>{formatRequestOverview(request, metadata)}</>;
};
