import { Button } from "@/components/ui/button";

export function QueryError({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm"
    >
      <p className="min-w-0 flex-1 break-words text-destructive">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? "Retrying..." : "Try Again"}
      </Button>
    </div>
  );
}
