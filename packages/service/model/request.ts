import { Type, type TObject } from '@sinclair/typebox';
import { RequestId, UserId, CourseId, FileReference, type RequestType } from './util.js';

export const RequestDetails = Type.Object({
    reason: Type.String(),
    proof: Type.Array(FileReference),
});

export const Response = Type.Object({
    instructorId: UserId,
    timestamp: Type.String({ format: "date-time" }),
    approved: Type.Boolean(),
    remark: Type.String(),
});

const BaseRequest = (type: RequestType, metadata: TObject) => {
    return Type.Object({
        id: RequestId,
        type: Type.Literal(type),
        studentId: UserId,
        courseId: CourseId,
        timestamp: Type.String({ format: "date-time" }),
        metadata: metadata,
        details: RequestDetails,
        response: Type.Union([Response, Type.Null()]),
    });
}

/* Below are actual request types */
/* Description of fields under metadata can be used at frontend */

export const SwapSectionRequest = BaseRequest(
    'Swap Section',
    Type.Object({
        fromSection: Type.String({
            description: "Original Section Code"
        }), // such as LA1, to be fetched from ITSO
        fromDate: Type.String({
            format: "date",
            description: "Date of the Original Class"
        }),
        toSection: Type.String({
            description: "Desired Section Code"
        }),
        toDate: Type.String({
            format: "date",
            description: "Date of the Desired Class"
        }),
    })
);

export const DeadlineExtensionRequest = BaseRequest(
    'Deadline Extension',
    Type.Object({
        assignmentName: Type.String({
            description: "Name of the Assignment"
        }), // filled by the student or added by instructors?
        requestedDeadline: Type.String({
            format: "date-time",
            description: "The New Deadline Being Requested"
        }),
    })
);

export const Request = Type.Union([
    SwapSectionRequest,
    DeadlineExtensionRequest,
]);