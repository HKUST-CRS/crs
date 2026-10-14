import type { JSX } from "bun-types/jsx";
import { match } from "ts-pattern";
import type {
  AbsentFromSectionRequest,
  DeadlineExtensionRequest,
  ExamAppealRequest,
  ExamSpecialArrangementRequest,
  Request,
  SwapSectionRequest,
} from "../models";
import { formatDate, formatDateTime } from "../utils/datetime";

type RequestPresentation = { subjectSuffix: string; details: JSX.Element };

function swapSection(request: SwapSectionRequest): RequestPresentation {
  const { fromSection, fromDate, toSection, toDate } = request.metadata;
  return {
    subjectSuffix: "",
    details: (
      <>
        The student is requesting to swap from section {fromSection} on{" "}
        {formatDate(fromDate)} to section {toSection} on {formatDate(toDate)}.
      </>
    ),
  };
}

function absentFromSection(
  request: AbsentFromSectionRequest,
): RequestPresentation {
  const { fromSection, fromDate } = request.metadata;
  return {
    subjectSuffix: "",
    details: (
      <>
        The student is requesting to be absent from section {fromSection} on{" "}
        {formatDate(fromDate)}.
      </>
    ),
  };
}

function deadlineExtension(
  request: DeadlineExtensionRequest,
): RequestPresentation {
  const { assignment, deadline } = request.metadata;
  return {
    subjectSuffix: "",
    details: (
      <>
        The student is requesting a deadline extension for assignment{" "}
        {assignment} to {formatDateTime(deadline)}.
      </>
    ),
  };
}

function examAppeal(request: ExamAppealRequest): RequestPresentation {
  const { examCode, question } = request.metadata;
  return {
    subjectSuffix: ` (${examCode} ${question})`,
    details: (
      <>
        The student is requesting a grade review of exam {examCode}, question{" "}
        {question}.
      </>
    ),
  };
}

function examSpecialArrangement(
  request: ExamSpecialArrangementRequest,
): RequestPresentation {
  const { examCode } = request.metadata;
  return {
    subjectSuffix: ` (${examCode})`,
    details: (
      <>The student is requesting a special arrangement for exam {examCode}.</>
    ),
  };
}

export function requestPresentation(request: Request): RequestPresentation {
  return match(request)
    .returnType<RequestPresentation>()
    .with({ type: "Swap Section" }, swapSection)
    .with({ type: "Absent from Section" }, absentFromSection)
    .with({ type: "Deadline Extension" }, deadlineExtension)
    .with({ type: "Exam Appeal" }, examAppeal)
    .with({ type: "Exam Special Arrangement" }, examSpecialArrangement)
    .exhaustive();
}
