import { Type } from '@sinclair/typebox';
import { RequestId, UserId, CourseId, FileReference } from './util.js';

export const RequestDetails = Type.Object({
    reason: Type.String(),
    proof: Type.Array(FileReference),
});

export const Response = Type.Object({
    instructorId: UserId,
    timestamp: Type.Date(),
    approved: Type.Boolean(),
    remark: Type.String(),
});

export const BaseRequest = Type.Object({
    id: RequestId,
    type: Type.String(),
    studentId: UserId,
    courseId: CourseId,
    timestamp: Type.Date(),
    metadata: Type.Object({}, { additionalProperties: true }),
    details: RequestDetails,
    response: Type.Union([Response, Type.Null()]),
});

/* Below are actual requests */
/* Description of fields under metadata can be used at frontend */

export const SwapSectionRequest = Type.Intersect([
    BaseRequest,
    Type.Object({
        type: Type.Literal('Swap Section'),
        metadata: Type.Object({
            fromSection: Type.String({
                description: "original section code"
            }), // such as LA1, to be fetched from ITSO
            fromDate: Type.String({
                description: "date of the original class"
            }),
            toSection: Type.String({
                description: "desired section code"
            }),
            toDate: Type.String({
                description: "date of the desired class"
            }),
        }),
    }),
]);

export const DeadlineExtensionRequest = Type.Intersect([
    BaseRequest,
    Type.Object({
        type: Type.Literal('Deadline Extension'),
        metadata: Type.Object({
            assignmentName: Type.String({
                description: "name of the assignment"
            }), // fill by the student or added by instructors?
            requestedDeadline: Type.Date({
                description: "the new deadline being requested"
            }),
        }),
    }),
]);