import { z } from "zod";

export const MAX_PROOF_SIZE = 4 * 1024 * 1024;
export const MAX_PROOF_FILES = 4;
const MAX_PROOF_CONTENT_LENGTH = Math.ceil(MAX_PROOF_SIZE / 3) * 4;

export const ProofUploadAccept = ["image/*", "application/pdf", "text/plain"];

/**
 * A supporting document attached to a thread comment, as stored and
 * returned to clients. The content lives in GridFS so attachment bytes
 * do not consume space in the request document; {@link ProofFile.id} is
 * the stable identifier used to retrieve those bytes, and
 * {@link ProofFile.hash} is the SHA-256 of those bytes so the request
 * signature commits to the file content. Clients fetch the content on
 * demand via the download endpoint.
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
  id: z.string().meta({ description: "The stable identifier of the file." }),
});
export type ProofFile = z.infer<typeof ProofFile>;

/**
 * A list of supporting documents. At most 4 files are allowed.
 */
export const ProofList = z
  .array(ProofFile)
  .max(
    MAX_PROOF_FILES,
    `At most ${MAX_PROOF_FILES} supporting documents are allowed.`,
  )
  .optional()
  .meta({
    description: "Optional supporting documents or files.",
  });
export type ProofList = z.infer<typeof ProofList>;

/**
 * A supporting document as supplied by a client on input: the base64
 * content is uploaded to GridFS by the server, which then stores a
 * {@link ProofFile} (carrying the `id`) on the thread entry.
 */
export const ProofFileInit = z.object({
  name: z.string().meta({ description: "The name of the file." }),
  size: z
    .number()
    .meta({ description: "The size of the file in bytes." })
    .max(MAX_PROOF_SIZE, "At most 4 MiB per file is allowed."),
  content: z
    .base64()
    .max(MAX_PROOF_CONTENT_LENGTH, "At most 4 MiB per file is allowed.")
    .meta({
      description: "The base64-encoded content of the file.",
    }),
});
export type ProofFileInit = z.infer<typeof ProofFileInit>;

/**
 * A list of supporting documents as supplied by a client on input. At
 * most 4 files are allowed.
 */
export const ProofListInit = z
  .array(ProofFileInit)
  .max(
    MAX_PROOF_FILES,
    `At most ${MAX_PROOF_FILES} supporting documents are allowed.`,
  )
  .optional()
  .meta({
    description: "Optional supporting documents or files.",
  });
export type ProofListInit = z.infer<typeof ProofListInit>;
