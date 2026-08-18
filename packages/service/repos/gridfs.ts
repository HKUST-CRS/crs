import { finished } from "node:stream/promises";
import { type GridFSBucket, MongoRuntimeError, ObjectId } from "mongodb";

/** Uploads one attachment and removes any partial GridFS chunks on failure. */
export async function uploadAttachment(
  bucket: GridFSBucket,
  name: string,
  bytes: Buffer,
): Promise<ObjectId> {
  const id = new ObjectId();
  const upload = bucket.openUploadStreamWithId(id, name);
  try {
    upload.end(bytes);
    await finished(upload);
    return id;
  } catch (uploadError) {
    try {
      // GridFS deletes chunks before reporting that the files document is
      // absent, which is the expected shape of a partial upload.
      await bucket.delete(id);
    } catch (cleanupError) {
      const partialUploadWasRemoved =
        cleanupError instanceof MongoRuntimeError &&
        cleanupError.message === `File not found for id ${id}`;
      if (!partialUploadWasRemoved) {
        throw new AggregateError(
          [uploadError, cleanupError],
          `Attachment upload and cleanup both failed for ${id}`,
        );
      }
    }
    throw uploadError;
  }
}

/** Deletes uploaded attachments, preserving both the original and cleanup errors. */
export async function rollbackAttachments(
  bucket: GridFSBucket,
  ids: ObjectId[],
  cause: unknown,
): Promise<never> {
  const results = await Promise.allSettled(ids.map((id) => bucket.delete(id)));
  const cleanupErrors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [cause, ...cleanupErrors],
      "Attachment operation failed and uploaded files could not be removed",
    );
  }
  throw cause;
}
