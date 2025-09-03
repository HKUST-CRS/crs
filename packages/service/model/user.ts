import { Type } from '@sinclair/typebox'
import { UserId, CourseId, RequestId } from './util'

const Role = Type.Union([
    Type.Literal('student'),
    Type.Literal('instructor'),
    Type.Literal('ta'),
]);

export const User = Type.Object({
    id: UserId,
    name: Type.String(),
    email: Type.String(),
    courses: Type.Array(
        Type.Object({
            courseId: CourseId,
            role: Role,
        })
    ),
    requestIds: Type.Array(RequestId),
});