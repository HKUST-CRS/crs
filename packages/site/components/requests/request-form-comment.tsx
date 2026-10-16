import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { ControllerRenderProps, UseFormReturn } from "react-hook-form";
import {
  type CommentInit,
  MAX_PROOF_FILES,
  MAX_PROOF_SIZE,
} from "service/models";
import { toast } from "sonner";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/showError";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { downloadBase64File, readProofs } from "./utils";

export type RequestFormCommentProps<
  TFieldValues extends { comment: CommentInit } = never,
  TContext = unknown,
  TTransformedValues = TFieldValues,
> = {
  viewonly?: boolean;
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
};

export function RequestFormComment<
  TFieldValues extends { comment: CommentInit },
  TContext,
  TTransformedValues extends TFieldValues,
>(props: RequestFormCommentProps<TFieldValues, TContext, TTransformedValues>) {
  const maxProofSizeMiB = MAX_PROOF_SIZE / 1024 / 1024;
  const [readingProof, setReadingProof] = useState(false);
  const viewonly = props.viewonly ?? false;
  // In viewonly mode the reason + proofs live in the thread (as the opening
  // comment), not on the request body, so there is nothing to render here.
  if (viewonly) return null;
  const form = props.form as unknown as UseFormReturn<
    { comment: CommentInit },
    TContext,
    TTransformedValues
  >;
  const comment = form.watch("comment");
  return (
    <>
      <FormField
        name="comment.text"
        control={form.control}
        render={({ field }) => (
          <FormItem className="col-span-full">
            <FormLabel>Reason</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormDescription>
              Please provide a brief explanation/justification for your request
              in a few sentences.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="comment.proofs"
        control={form.control}
        render={({ field }) => (
          <FormItem className="col-span-full">
            <FormLabel>Proof Documentation(s)</FormLabel>
            <ProofFileDropzone
              field={field}
              readingProof={readingProof}
              onReadingProofChange={setReadingProof}
            />
            <FormDescription>
              Please provide up to {MAX_PROOF_FILES} supporting documents for
              your request. The maximum file size is {maxProofSizeMiB} MiB each.
            </FormDescription>
            <ul className="typo-muted">
              {comment?.proofs &&
                comment.proofs.length > 0 &&
                comment.proofs.map((f, i) => (
                  <li key={f.name + String(i)}>
                    <button
                      type="button"
                      className="pointer-events-auto cursor-pointer underline"
                      onClick={() => downloadBase64File(f.content, f.name)}
                    >
                      {f.name}
                    </button>{" "}
                    ({(f.size / 1024 / 1024).toFixed(2)} MiB)
                  </li>
                ))}
            </ul>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="col-span-full flex justify-end">
        <Button type="submit" disabled={readingProof}>
          Submit
        </Button>
      </div>
    </>
  );
}

type ProofFileDropzoneProps = {
  field: ControllerRenderProps<{ comment: CommentInit }, "comment.proofs">;
  readingProof: boolean;
  onReadingProofChange: (reading: boolean) => void;
};

function ProofFileDropzone({
  field,
  readingProof,
  onReadingProofChange,
}: ProofFileDropzoneProps) {
  const proofSelectionToken = useRef(0);
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragGlobal,
    isDragReject,
  } = useDropzone({
    accept: {
      "image/*": [],
      "application/pdf": [],
      "text/plain": [],
    },
    maxFiles: MAX_PROOF_FILES,
    maxSize: MAX_PROOF_SIZE,
    multiple: true,
    disabled: readingProof,
    onDrop: async (acceptedFiles, fileRejections) => {
      if (fileRejections.length > 0) {
        const firstError = fileRejections[0]?.errors[0];
        if (firstError?.code === "too-many-files") {
          toast.error(`Please select up to ${MAX_PROOF_FILES} files.`);
        } else if (firstError?.code === "file-too-large") {
          toast.error(
            `Each file must be no larger than ${MAX_PROOF_SIZE / 1024 / 1024} MiB.`,
          );
        } else if (firstError?.code === "file-invalid-type") {
          toast.error("Please select an image, PDF, or plain-text file.");
        } else {
          showError(
            new Error(firstError?.message ?? "Some files could not be added."),
            "File Upload Error",
          );
        }
      }

      if (acceptedFiles.length === 0) return;

      const token = ++proofSelectionToken.current;
      field.onChange(undefined);
      onReadingProofChange(true);
      try {
        const converted = (await readProofs(
          acceptedFiles,
        )) satisfies CommentInit["proofs"];
        if (token === proofSelectionToken.current) {
          field.onChange(converted);
        }
      } catch (error) {
        if (token === proofSelectionToken.current) {
          showError(
            new Error(
              `Failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
            "File Upload Error",
          );
        }
      } finally {
        if (token === proofSelectionToken.current) {
          onReadingProofChange(false);
        }
      }
    },
  });

  let dropzoneMessage: string;
  if (readingProof) {
    dropzoneMessage = "Reading selected files…";
  } else if (isDragActive && isDragReject) {
    dropzoneMessage = "Some files may not meet the file requirements";
  } else if (isDragGlobal) {
    dropzoneMessage = "Drop files here to upload";
  } else {
    dropzoneMessage = "Click to choose files or drag them here";
  }

  return (
    <div>
      <FormControl>
        <div
          {...getRootProps({
            className: cn(
              "relative flex min-h-20 w-full cursor-pointer items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isDragGlobal
                ? "border-transparent bg-background text-primary"
                : "border-input bg-background hover:border-solid hover:border-foreground",
              readingProof && "cursor-wait opacity-60",
            ),
          })}
        >
          <input {...getInputProps()} />
          <span className="relative z-10">{dropzoneMessage}</span>
          {isDragGlobal && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute text-primary"
              style={{
                left: "-1px",
                top: "-1px",
                width: "calc(100% + 2px)",
                height: "calc(100% + 2px)",
              }}
            >
              <style>{`
                @keyframes proof-dropzone-dash-flow {
                  to { stroke-dashoffset: -16; }
                }
                .proof-dropzone-animated-border {
                  animation: proof-dropzone-dash-flow 700ms linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                  .proof-dropzone-animated-border { animation: none; }
                }
              `}</style>
              <rect
                className="proof-dropzone-animated-border"
                x="0.5"
                y="0.5"
                width="calc(100% - 1px)"
                height="calc(100% - 1px)"
                rx="calc(var(--radius-md) - 0.5px)"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="5 5"
              />
            </svg>
          )}
        </div>
      </FormControl>
    </div>
  );
}
