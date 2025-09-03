import { Type, type Static } from '@sinclair/typebox';

export const ObjectId = Type.RegExp(/^[0-9a-fA-F]{24}$/, {
    description: 'MongoDB ObjectId as a 24-character hexadecimal string',
});

// placeholders
export const UserId = Type.String();
export const CourseId = Type.String();
export const RequestId = ObjectId;
export const FileReference = Type.Object({
    fileId: ObjectId,
    fileName: Type.String(),
});

const ALL_REQUEST_TYPES = [
    'Swap Section',
    'Deadline Extension',
] as const;
export const RequestType = Type.Union(ALL_REQUEST_TYPES.map(t => Type.Literal(t)));
export type RequestType = Static<typeof RequestType>;