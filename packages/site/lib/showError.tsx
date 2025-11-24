import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

const ghIssue = (error: Error) => {
  if (error instanceof TRPCClientError) {
    const title = `[Uncaught Server TRPCError] ${error.message}`;
    const body = `##### Meta
\`\`\`
${JSON.stringify(error.meta, null, 2)}
\`\`\`
`;
    const params = new URLSearchParams({
      title,
      body,
    });
    return `https://www.github.com/HKUST-CRS/crs/issues/new?${params.toString()}`;
  }
  const title = `[Uncaught Server Error] ${error.message}`;
  const body = `##### Meta
\`\`\`
${error}
\`\`\`
`;
  const params = new URLSearchParams({
    title,
    body,
  });
  return `https://www.github.com/HKUST-CRS/crs/issues/new?${params.toString()}`;
};

export const showError = (error: Error) => {
  toast.error(
    <>
      <p>{error.message}</p>
      <p className="text-[0.875em]">
        Oops... An error occurred. Please{" "}
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
