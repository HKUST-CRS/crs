import { z } from 'zod';

export const ObjectId = z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { error: 'Invalid ObjectId format.' })
    .describe('MongoDB ObjectId as a 24-character hexadecimal string');

// placeholders
export const UserId = ObjectId;
export const CourseId = ObjectId;
export const RequestId = ObjectId;
export const FileReference = z.object({
    fileId: ObjectId,
    fileName: z.string(),
});

const ALL_REQUEST_TYPES = [
    'Swap Section',
    'Deadline Extension',
] as const;
export const RequestType = z.literal(ALL_REQUEST_TYPES);
export type RequestType = z.infer<typeof RequestType>;