import type { UseFormReturn } from "react-hook-form";
import { type RequestDetails, RequestDetailsProofAccept } from "service/models";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type RequestFormDetailsProps<
  TFieldValues extends { details: RequestDetails } = never,
  TContext = unknown,
  TTransformedValues = TFieldValues,
> = {
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
};

export function RequestFormDetails<
  TFieldValues extends { details: RequestDetails },
  TContext,
  TTransformedValues extends TFieldValues,
>(props: RequestFormDetailsProps<TFieldValues, TContext, TTransformedValues>) {
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
                  onChange={(e) => {
                    if (e.target.files) {
                      field.onChange([...e.target.files]);
                    }
                  }}
                  type="file"
                  accept={RequestDetailsProofAccept.join(",")}
                  multiple
                />
              </div>
            </FormControl>
            <FormDescription>
              Please provide any supporting documents for your request. The
              maximum file size is 2 MiB each.
            </FormDescription>
            <ul className="typo-muted">
              {details?.proof &&
                details.proof.length > 0 &&
                details.proof.map((f, i) => (
                  <li key={f.name + String(i)}>
                    {f.name} ({(f.size / 1024 / 1024).toFixed(2)} MiB)
                  </li>
                ))}
            </ul>
          </FormItem>
        )}
      />
    </>
  );
}
