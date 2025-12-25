"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { CourseId } from "service/models";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc-client";
import { AssignmentsConfig } from "./assignment/assignments-config";
import { SectionsConfig } from "./section/sections-config";

export function CourseSettings({ cid }: { cid: CourseId }) {
  const trpc = useTRPC();
  const { data: course, refetch } = useQuery(trpc.course.get.queryOptions(cid));

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

  if (!course) return null;
  return (
    <div className="space-y-8">
      <SectionsConfig
        course={course}
        onUpdate={(sections) =>
          updateSections.mutate({ courseId: cid, sections })
        }
      />
      <AssignmentsConfig
        course={course}
        onUpdate={(assignments) => {
          updateAssignments.mutate({ courseId: cid, assignments });
        }}
      />
    </div>
  );
}
