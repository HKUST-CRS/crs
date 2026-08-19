/** Parses a newline-separated list of emails into an array, or undefined when empty. */
export function parseEmails(text: string): string[] | undefined {
  const emails = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return emails.length > 0 ? emails : undefined;
}

/** Converts an email array back to newline-separated text for a textarea. */
export function emailsToText(emails: string[] | undefined): string {
  return (emails ?? []).join("\n");
}
