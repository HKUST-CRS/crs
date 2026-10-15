import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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
import { RoasterParser } from "@/lib/roaster-parser";
import { showErrorMessage } from "@/lib/showError";

export const ImportEnrollmentFormSchema = z.strictObject({
  roaster: z.file().min(1, "Roster file is required."),
  section: z.string().min(1, "Section is required."),
  role: Role.nonoptional("Role is required."),
});

export type ImportEnrollmentFormSchema = z.infer<
  typeof ImportEnrollmentFormSchema
>;

export const ImportEnrollmentSubmissionSchema = z.strictObject({
  roaster: RoasterParser.Roaster,
  section: z.string(),
  role: Role,
});

export type ImportEnrollmentSubmissionSchema = z.infer<
  typeof ImportEnrollmentSubmissionSchema
>;

function toMessage(roaster: RoasterParser.Roaster) {
  return roaster.map((row, idx) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: only possible key
    <span key={idx} className="block">
      [Row {idx}] User <b>{row.email}</b> ({row.name})
    </span>
  ));
}

export function ImportEnrollmentForm({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (v: ImportEnrollmentSubmissionSchema) => Promise<void>;
  disabled?: boolean;
}) {
  const form = useForm<ImportEnrollmentFormSchema>({
    resolver: zodResolver(ImportEnrollmentFormSchema),
    defaultValues: {
      section: "",
    },
  });

  const roasterFile = form.watch("roaster");
  const [[parsedFile, parsedRoaster, parseError], setParseResult] = useState<
    [File | undefined, RoasterParser.Roaster | null, string | null]
  >([undefined, [], null]);
  const isCurrentFile = parsedFile === roasterFile;
  const roaster = isCurrentFile ? parsedRoaster : null;
  const error = isCurrentFile ? parseError : null;
  const isParsing = !!roasterFile && !isCurrentFile;
  useEffect(() => {
    let cancelled = false;
    if (roasterFile) {
      async function parse() {
        try {
          const data = await roasterFile.arrayBuffer();
          const rows = RoasterParser.parseSheet(data);
          if (!cancelled) setParseResult([roasterFile, rows, null]);
        } catch (e) {
          if (!cancelled) {
            const message =
              e instanceof z.ZodError
                ? z.prettifyError(e)
                : e instanceof Error
                  ? e.message
                  : "Could not read this roster. Please choose another file.";
            setParseResult([roasterFile, null, message]);
          }
        }
      }
      void parse();
    } else {
      setParseResult([undefined, [], null]);
    }
    return () => {
      cancelled = true;
    };
  }, [roasterFile]);

  const message = useMemo(() => toMessage(roaster ?? []), [roaster]);

  const handleSubmit = async (data: ImportEnrollmentFormSchema) => {
    if (!disabled && roaster?.length && !isParsing) {
      await onSubmit({
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
            <FieldLabel htmlFor="import-enrollment-roster">Roster</FieldLabel>
            <Input
              id="import-enrollment-roster"
              disabled={disabled || form.formState.isSubmitting}
              onChange={(e) => {
                const files = e.target.files;

                if (!files || files.length === 0) {
                  field.onChange(undefined);
                  e.target.value = "";
                  return;
                }

                if (files.length !== 1) {
                  showErrorMessage("Please upload exactly one file.");
                  field.onChange(undefined);
                  e.target.value = "";
                  return;
                }

                field.onChange(files[0]);
              }}
              type="file"
              accept={[
                "text/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ].join(",")}
            />
            <FieldDescription>
              Upload the roster from SIS in CSV or Excel (XLS, XLSX) format. The
              file should contain only one sheet, and the sheet should have a
              header row with "Email Address" and optionally "Name" columns.
            </FieldDescription>
            <div className="max-h-32 overflow-y-auto">
              <FieldDescription className="whitespace-pre-wrap font-mono">
                {isParsing ? "Reading roster…" : message}
              </FieldDescription>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="section"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="import-enrollment-section">Section</FieldLabel>
            <Input
              id="import-enrollment-section"
              placeholder="L1"
              {...field}
              disabled={disabled || form.formState.isSubmitting}
            />
            <FieldDescription>
              The section to enroll the users into. A request for a section can
              only be made by a student in the section, and a request for a
              section can be handled by an instructor in the section, or by its
              assigned grader for an exam question. An asterisk (*) covers all
              sections; use it for a grader responsible for the whole course.
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
            <FieldLabel htmlFor="import-enrollment-role">Role</FieldLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled || form.formState.isSubmitting}
            >
              <SelectTrigger id="import-enrollment-role" className="w-full">
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
              only view the requests. A grader can view, comment on, and decide
              appeals for their assigned exam questions, within their enrolled
              sections. An admin can only manage the course.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <DialogFooter className="col-span-full gap-2">
        <Button
          type="submit"
          disabled={
            disabled ||
            form.formState.isSubmitting ||
            isParsing ||
            !roaster?.length
          }
        >
          {form.formState.isSubmitting ? "Adding…" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}
