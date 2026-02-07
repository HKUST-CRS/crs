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
import { showError, showErrorMessage } from "@/lib/showError";

export const ImportEnrollmentFormSchema = z.object({
  roaster: z.file().min(1, "Roaster file is required."),
  section: z.string().min(1, "Section is required."),
  role: Role.nonoptional("Role is required."),
});

export type ImportEnrollmentFormSchema = z.infer<
  typeof ImportEnrollmentFormSchema
>;

export const ImportEnrollmentSubmissionSchema = z.object({
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

function toErrorMessage(error: z.ZodError) {
  return z.prettifyError(error);
}

export function ImportEnrollmentForm({
  onSubmit,
}: {
  onSubmit: (v: ImportEnrollmentSubmissionSchema) => void;
}) {
  const form = useForm<ImportEnrollmentFormSchema>({
    resolver: zodResolver(ImportEnrollmentFormSchema),
    defaultValues: {
      section: "",
    },
  });

  const roasterFile = form.watch("roaster");
  const [[roaster, error], setParseResult] = useState<
    [RoasterParser.Roaster, null] | [null, z.ZodError]
  >([[], null]);
  useEffect(() => {
    if (roasterFile) {
      async function parse() {
        try {
          const data = await roasterFile.arrayBuffer();
          setParseResult([RoasterParser.parseSheet(data), null] as const);
        } catch (e) {
          if (e instanceof z.ZodError) {
            setParseResult([null, e]);
          } else {
            setParseResult([[], null]);
          }
          if (e instanceof Error) {
            showError(e);
          }
          throw e;
        }
      }
      parse();
    } else {
      setParseResult([[], null]);
    }
  }, [roasterFile]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: IDK Biome
  const message = useMemo(() => {
    if (roaster) {
      return toMessage(roaster);
    } else {
      return toErrorMessage(error);
    }
  }, [roaster, error]);

  const handleSubmit = (data: ImportEnrollmentFormSchema) => {
    if (roaster && roaster.length > 0) {
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
            <Input
              onChange={async (e) => {
                if (e.target.files) {
                  if (e.target.files.length !== 1) {
                    showErrorMessage("Please upload exactly one file.");
                    e.target.value = "";
                    return;
                  }
                  field.onChange(e.target.files[0]);
                }
              }}
              type="file"
              accept={[
                "text/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ].join(",")}
            />
            <FieldDescription>
              Upload the roaster from SIS in CSV or Excel (XLS, XLSX) format.
              The file should contain only one sheet, and the sheet should have
              a header row with "Email Address" and optionally "Name" columns.
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
