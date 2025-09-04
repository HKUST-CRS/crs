import { z } from 'zod';
import { RequestId, UserId, CourseId, FileReference, RequestType } from './util.js';

export const RequestDetails = z.object({
    reason: z.string(),
    proof: z.array(FileReference),
});

export const Response = z.object({
    instructorId: UserId,
    timestamp: z.iso.datetime(),
    approved: z.boolean(),
    remark: z.string(),
});

export const BaseRequest = z.object({
    _id: RequestId,
    type: RequestType,
    studentId: UserId,
    courseId: CourseId,
    timestamp: z.iso.datetime(),
    metadata: z.object(),
    details: RequestDetails,
    response: z.union([Response, z.null()]),
});

const RequestConstructor = (type: RequestType, metadata: z.ZodObject) => {
    return BaseRequest.extend({
        type: z.literal(type),
        metadata: metadata,
    });
};

/* Below are actual request types */
/* Description of fields under metadata can be used at frontend */

export const SwapSectionRequest = RequestConstructor(
    'Swap Section',
    z.object({
        fromSection: z.string()
            .describe('Original Section Code'), // such as LA2, to be fetched from ITSO
        fromDate: z.iso.date()
            .describe('Date of the Original Class'),
        toSection: z.string()
            .describe('Desired Section Code'),
        toDate: z.iso.date()
            .describe('Date of the Desired Class'),
    })
);

export const DeadlineExtensionRequest = RequestConstructor(
    'Deadline Extension',
    z.object({
        assignmentName: z.string()
            .describe('Name of the Assignment'), // filled by the student or added by instructors?
        requestedDeadline: z.iso.datetime()
            .describe('The New Deadline Being Requested'),
    })
);

export const ConcreteRequest = z.union([
    SwapSectionRequest,
    DeadlineExtensionRequest,
]);