import type { JSX } from "bun-types/jsx";
import {
  Classes,
  type Request,
  type RequestDetails,
  type Response,
  type User,
} from "../models";
import { formatDate, formatDateTime } from "../utils/datetime";

type Metadata = {
  student: User;
  instructors: User[];
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
      {formatRequestDetails(request.details)}
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

const formatRequestDetails = (details: RequestDetails): JSX.Element => {
  const reasonLine = details.reason;
  const proofLine = details.proof ?? [];
  return (
    <>
      {reasonLine ? (
        <>
          <p>The reason for the request is as follows:</p>
          <blockquote>{reasonLine}</blockquote>
        </>
      ) : (
        <p>The student did not provide a reason for the request.</p>
      )}
      {proofLine.length ? (
        <p>
          There are {proofLine.length} proof documents for the request attached.
        </p>
      ) : (
        <p>The student did not attach any proof documents.</p>
      )}
    </>
  );
};

const formatResponse = (
  response: Response,
  metadata: Metadata,
): JSX.Element => {
  const responder = metadata.instructors.find(
    (instructor) => instructor.email === response.from,
  );

  const name = responder?.name ?? "Unknown Instructor";
  const email = responder?.email ?? response.from;
  const timestamp = formatDateTime(response.timestamp);
  const decision = response.decision;
  const remarks = response.remarks;
  return (
    <>
      <p>
        {name} (<a href={`mailto:${email}`}>{email}</a>) has made a decision of{" "}
        <b>{decision}</b> at {timestamp} to the request.{" "}
        {remarks ? (
          <>The remarks are as follows:</>
        ) : (
          <>The instructor did not provide any remarks for the response.</>
        )}
      </p>
      {remarks && <blockquote>{remarks}</blockquote>}
    </>
  );
};

/**
 * Formats a request into a human-readable format as JSX. This can be further
 * transformed into a HTML string used for email notifications or other purposes.
 */
export const formatRequest = (
  request: Request,
  metadata: Metadata,
): JSX.Element => {
  return (
    <>
      {formatRequestOverview(request, metadata)}
      {request.response && formatResponse(request.response, metadata)}
    </>
  );
};
