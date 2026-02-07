import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Role, Roles } from "service/models";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RoasterParser } from "@/lib/roaster-parser";

export const AddEnrollmentFormSchema = z.object({
  roaster: z.string().min(1, "Roaster is required."),
  section: z.string().min(1, "Section is required."),
  role: Role.nonoptional("Role is required."),
});

export type AddEnrollmentFormSchema = z.infer<typeof AddEnrollmentFormSchema>;

export const AddEnrollmentSubmissionSchema = z.object({
  roaster: RoasterParser.Roaster,
  section: z.string(),
  role: Role,
});

export type AddEnrollmentSubmissionSchema = z.infer<
  typeof AddEnrollmentSubmissionSchema
>;

function toMessage(roaster: RoasterParser.Roaster) {
  return roaster.map((row, idx) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: only possible key
    <span key={idx} className="block">
      [Row {idx}] User <b>{row.email}</b> ({row.name})
    </span>
  ));
}

function toErrorMessage(error: z.ZodError) {
  return z.prettifyError(error);
}

export function AddEnrollmentForm({
  onSubmit,
}: {
  onSubmit: (v: AddEnrollmentSubmissionSchema) => void;
}) {
  const form = useForm<AddEnrollmentFormSchema>({
    resolver: zodResolver(AddEnrollmentFormSchema),
    defaultValues: {
      roaster: "",
      section: "",
    },
  });

  const roasterText = form.watch("roaster");
  const [roaster, error] = useMemo(() => {
    try {
      return [RoasterParser.parseText(roasterText), null] as const;
    } catch (e) {
      if (e instanceof z.ZodError) {
        return [null, e] as const;
      }
      throw e;
    }
  }, [roasterText]);
  const message = useMemo(() => {
    if (roaster) {
      return toMessage(roaster);
    } else {
      return toErrorMessage(error);
    }
  }, [roaster, error]);

  const handleSubmit = (data: AddEnrollmentFormSchema) => {
    if (roaster) {
      onSubmit({
        roaster,
        section: data.section,
        role: data.role,
      });
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="grid grid-cols-1 gap-4"
    >
      <Controller
        name="roaster"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Roaster</FieldLabel>
            <Textarea
              placeholder={
                "example1@connect.ust.hk\n" +
                "example2@connect.ust.hk\n" +
                "example3@connect.ust.hk\n"
              }
              rows={10}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="max-h-32 font-mono"
              {...field}
            />
            <FieldDescription>
              The roaster of the users to be enrolled. One email per line.
              Optionally, the name of the user can be included after the email,
              separated by a comma.
            </FieldDescription>
            <div className="max-h-32 overflow-y-auto">
              <FieldDescription className="whitespace-pre-wrap font-mono">
                {message}
              </FieldDescription>
            </div>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="section"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Section</FieldLabel>
            <Input placeholder="L1" {...field} />
            <FieldDescription>
              The section to enroll the users into. A request for a section can
              only be made by a student in the section, and a request for a
              section can only be responded by an instructor in the section.
              Specifically, an asterisk (*) denotes all/any sections.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="role"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {Roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              A student can create requests. An instructor can view the
              requests, manage the course (such as setting up sections and
              assignments), and approve/reject the requests. An observer can
              only view the requests. An admin can only manage the course.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <DialogFooter className="col-span-full gap-2">
        <Button type="submit">Add</Button>
      </DialogFooter>
    </form>
  );
}
