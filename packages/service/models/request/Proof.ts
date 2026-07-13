import { z } from "zod";

/**
 * A supporting document attached to a request or a thread entry.
 */
export const ProofFile = z.object({
  name: z.string().meta({ description: "The name of the file." }),
  size: z
    .number()
    .meta({ description: "The size of the file in bytes." })
    .max(2 * 1024 * 1024, "At most 2 MiB per file is allowed."),
  content: z.base64().meta({
    description: "The base64-encoded content of the file. ",
  }),
});
export type ProofFile = z.infer<typeof ProofFile>;

/**
 * A list of supporting documents. At most 4 files are allowed.
 */
export const Proof = z
  .array(ProofFile)
  .max(4, "At most 4 supporting documents are allowed.")
  .optional()
  .meta({
    description: "Optional supporting documents or files.",
  });
export type Proof = z.infer<typeof Proof>;
