import { useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  MAX_PROOF_FILES,
  MAX_PROOF_SIZE,
  type RequestDetails,
  RequestDetailsProofAccept,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "../ui/button";
import { downloadBase64File, readFileAsBase64 } from "./utils";

export type RequestFormDetailsProps<
  TFieldValues extends { details: RequestDetails } = never,
  TContext = unknown,
  TTransformedValues = TFieldValues,
> = {
  viewonly?: boolean;
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
};

export function RequestFormDetails<
  TFieldValues extends { details: RequestDetails },
  TContext,
  TTransformedValues extends TFieldValues,
>(props: RequestFormDetailsProps<TFieldValues, TContext, TTransformedValues>) {
  const maxProofSizeMiB = MAX_PROOF_SIZE / 1024 / 1024;
  const proofSelectionToken = useRef(0);
  const [readingProof, setReadingProof] = useState(false);
  const [proofKey, setProofKey] = useState(0);
  const viewonly = props.viewonly ?? false;
  // In viewonly mode the reason + proof live in the thread (as the opening
  // comment), not on the request body, so there is nothing to render here.
  if (viewonly) return null;
  const form = props.form as unknown as UseFormReturn<
    { details: RequestDetails },
    TContext,
    TTransformedValues
  >;
  const details = form.watch("details");
  return (
    <>
      <FormField
        name={"details.reason"}
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
        name="details.proof"
        control={form.control}
        render={({ field }) => (
          <FormItem className="col-span-full">
            <FormLabel>Proof Documentation(s)</FormLabel>
            <FormControl>
              <div>
                <Input
                  key={proofKey}
                  onChange={async (e) => {
                    if (e.target.files) {
                      const token = ++proofSelectionToken.current;
                      field.onChange(undefined);
                      setReadingProof(true);
                      try {
                        const proof = (await Promise.all(
                          [...e.target.files].map(async (f) => {
                            const content = await readFileAsBase64(f);
                            return {
                              name: f.name,
                              size: f.size,
                              content,
                            };
                          }),
                        )) satisfies RequestDetails["proof"];
                        if (token === proofSelectionToken.current) {
                          field.onChange(proof);
                        }
                      } catch (error) {
                        if (token === proofSelectionToken.current) {
                          setProofKey((key) => key + 1);
                          toast.error(
                            `Failed: ${error instanceof Error ? error.message : String(error)}`,
                          );
                        }
                      } finally {
                        if (token === proofSelectionToken.current) {
                          setReadingProof(false);
                        }
                      }
                    }
                  }}
                  type="file"
                  accept={RequestDetailsProofAccept.join(",")}
                  multiple
                  disabled={readingProof}
                />
              </div>
            </FormControl>
            <FormDescription>
              Please provide up to {MAX_PROOF_FILES} supporting documents for
              your request. The maximum file size is {maxProofSizeMiB} MiB each.
            </FormDescription>
            <ul className="typo-muted">
              {details?.proof &&
                details.proof.length > 0 &&
                details.proof.map((f, i) => (
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
