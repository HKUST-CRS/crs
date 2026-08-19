"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Course, CourseID } from "service/models";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc-client";
import { AssignmentsConfig } from "./assignment/assignments-config";
import { RequestTypesConfig } from "./request-types-config";
import { SectionsConfig } from "./section/sections-config";

export function CourseSettings({ cid }: { cid: CourseID }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const courseQuery = trpc.course.get.queryOptions(cid);
  const { data: course, refetch } = useQuery(courseQuery);

  const updateSections = useMutation({
    ...trpc.course.updateSections.mutationOptions(),
    onSuccess: () => {
      toast.success("Successfully updated the sections.");
      refetch();
    },
  });

  const updateAssignments = useMutation({
    ...trpc.course.updateAssignments.mutationOptions(),
    onSuccess: () => {
      toast.success("Successfully updated the assignments.");
      refetch();
    },
  });

  const requestTypeMutationOptions =
    trpc.course.updateEffectiveRequestTypes.mutationOptions<{
      previousCourse: Course | undefined;
    }>();
  const updateRequestTypes = useMutation({
    ...requestTypeMutationOptions,
    onMutate: async ({ effectiveRequestTypes }) => {
      await queryClient.cancelQueries({ queryKey: courseQuery.queryKey });
      const previousCourse = queryClient.getQueryData(courseQuery.queryKey);

      queryClient.setQueryData(courseQuery.queryKey, (current) =>
        current ? { ...current, effectiveRequestTypes } : current,
      );

      return { previousCourse };
    },
    onSuccess: () => {
      toast.success("Successfully updated the effective request types.");
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(courseQuery.queryKey, context.previousCourse);
      }
      toast.error(error.message);
    },
  });

  if (!course) return null;
  return (
    <div className="space-y-8">
      <RequestTypesConfig
        course={course}
        onUpdate={(effectiveRequestTypes) =>
          updateRequestTypes.mutate({
            courseID: cid,
            effectiveRequestTypes,
          })
        }
      />
      <SectionsConfig
        course={course}
        onUpdate={(sections) =>
          updateSections.mutate({ courseID: cid, sections })
        }
      />
      <AssignmentsConfig
        course={course}
        onUpdate={(assignments) => {
          updateAssignments.mutate({ courseID: cid, assignments });
        }}
      />
    </div>
  );
}
