"use client";

import { type Course, Requests } from "service/models";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription } from "@/components/ui/field";

export function RequestTypesConfig({
  course,
  onUpdate,
}: {
  course: Course;
  onUpdate: (requestTypes: Course["effectiveRequestTypes"]) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold leading-none">Effective Request Types</h2>
      <fieldset className="grid gap-3 md:grid-cols-3">
        <legend className="sr-only">Effective Request Types</legend>
        {Requests.map((schema) => {
          const type = schema.shape.type.value;
          const id = `request-type-${type.toLowerCase().replaceAll(" ", "-")}`;
          return (
            <label
              key={type}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
            >
              <Checkbox
                id={id}
                checked={course.effectiveRequestTypes[type]}
                onCheckedChange={(checked) =>
                  onUpdate({
                    ...course.effectiveRequestTypes,
                    [type]: checked === true,
                  })
                }
              />
              <span>{schema.meta()?.title ?? type}</span>
            </label>
          );
        })}
      </fieldset>
      <FieldDescription>
        Students can only submit request types enabled here.
      </FieldDescription>
    </section>
  );
}
