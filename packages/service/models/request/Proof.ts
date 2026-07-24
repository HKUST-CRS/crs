import { z } from "zod";

const MAX_PROOF_SIZE = 2 * 1024 * 1024;
const MAX_PROOF_CONTENT_LENGTH = Math.ceil(MAX_PROOF_SIZE / 3) * 4;

/**
 * A supporting document attached to a request or a thread entry.
 */
export const ProofFile = z.object({
  name: z.string().meta({ description: "The name of the file." }),
  size: z
    .number()
    .meta({ description: "The size of the file in bytes." })
    .max(MAX_PROOF_SIZE, "At most 2 MiB per file is allowed."),
  content: z
    .base64()
    .max(MAX_PROOF_CONTENT_LENGTH, "At most 2 MiB per file is allowed.")
    .meta({
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
