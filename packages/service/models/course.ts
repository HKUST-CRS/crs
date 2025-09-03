import { Type } from '@sinclair/typebox'
import { UserId, CourseId, RequestId, RequestType } from './util';

export const Course = Type.Object({
    id: CourseId,
    title: Type.String(),
    studentIds: Type.Array(UserId),
    instructorIds: Type.Array(UserId),
    taIds: Type.Array(UserId),
    requestIds: Type.Array(RequestId),
    requestTypesEnabled: Type.Array(RequestType),
})