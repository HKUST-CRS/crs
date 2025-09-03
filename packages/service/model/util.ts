import { Type } from '@sinclair/typebox';

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