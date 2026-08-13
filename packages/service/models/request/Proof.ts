import { z } from "zod";

export const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const MAX_PROOF_CONTENT_LENGTH = Math.ceil(MAX_PROOF_SIZE / 3) * 4;

/**
 * A supporting document attached to a request or a thread entry, as stored and
 * returned to clients. The content lives in GridFS (outside the document so the
 * thread cannot overflow a Mongo document); {@link ProofFile.fileId} is the
 * GridFS ObjectId of the stored bytes, and {@link ProofFile.hash} is the
 * SHA-256 of those bytes so the request signature commits to the file content
 * (not just the storage reference). Clients fetch the content on demand via
 * the download endpoint.
 */
export const ProofFile = z.object({
  name: z.string().meta({ description: "The name of the file." }),
  size: z
    .number()
    .meta({ description: "The size of the file in bytes." })
    .max(MAX_PROOF_SIZE, "At most 4 MiB per file is allowed."),
  hash: z
    .string()
    .meta({ description: "The SHA-256 of the stored file bytes." }),
  fileId: z
    .string()
    .meta({ description: "The GridFS ObjectId of the stored content." }),
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

/**
 * A supporting document as supplied by a client on input: the base64 content is
 * uploaded to GridFS by the server, which then stores a {@link ProofFile}
 * (carrying the `fileId`) on the thread entry.
 */
export const ProofFileUpload = z.object({
  name: z.string().meta({ description: "The name of the file." }),
  size: z
    .number()
    .meta({ description: "The size of the file in bytes." })
    .max(MAX_PROOF_SIZE, "At most 4 MiB per file is allowed."),
  content: z
    .string()
    .base64()
    .max(MAX_PROOF_CONTENT_LENGTH, "At most 4 MiB per file is allowed.")
    .meta({
      description: "The base64-encoded content of the file.",
    }),
});
export type ProofFileUpload = z.infer<typeof ProofFileUpload>;

/**
 * Client-supplied supporting documents. At most 4 files are allowed.
 */
export const ProofUpload = z
  .array(ProofFileUpload)
  .max(4, "At most 4 supporting documents are allowed.")
  .optional()
  .meta({
    description: "Optional supporting documents or files.",
  });
export type ProofUpload = z.infer<typeof ProofUpload>;
