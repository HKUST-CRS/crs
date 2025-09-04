import { z } from 'zod';
import { RequestId, UserId, CourseId, FileReference, type RequestType } from './util.js';

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

const BaseRequest = (type: RequestType, metadata: z.ZodObject) => {
    return z.object({
        _id: RequestId,
        type: z.literal(type),
        studentId: UserId,
        courseId: CourseId,
        timestamp: z.iso.datetime(),
        metadata: metadata,
        details: RequestDetails,
        response: z.union([Response, z.null()]),
    });
}

/* Below are actual request types */
/* Description of fields under metadata can be used at frontend */

export const SwapSectionRequest = BaseRequest(
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

export const DeadlineExtensionRequest = BaseRequest(
    'Deadline Extension',
    z.object({
        assignmentName: z.string()
            .describe('Name of the Assignment'), // filled by the student or added by instructors?
        requestedDeadline: z.iso.datetime()
            .describe('The New Deadline Being Requested'),
    })
);

export const Request = z.union([
    SwapSectionRequest,
    DeadlineExtensionRequest,
]);