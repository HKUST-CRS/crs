import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

const ghIssue = (error: Error) => {
  const isTRPCError = error instanceof TRPCClientError;
  const title = `[Uncaught Server ${isTRPCError ? "TRPCError" : "Error"}] ${error.message}`;
  const body = `##### Meta
\`\`\`
${isTRPCError ? JSON.stringify(error.meta, null, 2) : error}
\`\`\`
`;
  const params = new URLSearchParams({
    title,
    body,
  });
  return `https://github.com/HKUST-CRS/crs/issues/new?${params.toString()}`;
};

export const showError = (error: Error) => {
  toast.error(
    <>
      <p>{error.message}</p>
      <p className="text-[0.875em]">
        Oops... Something went wrong. Please{" "}
        <a
          className="underline"
          href={ghIssue(error)}
          target="_blank"
          rel="noopener noreferrer"
        >
          report it
        </a>{" "}
        to us.
      </p>
    </>,
  );
};

export const showErrorMessage = (error: string) => {
  toast.error(
    <>
      <p>{error}</p>
      <p className="text-[0.875em]">Oops... Something went wrong.</p>
    </>,
  );
};
