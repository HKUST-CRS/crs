/**
 * Run a notification as a best-effort side effect.
 *
 * Every caller invokes this *after* the database write has already committed
 * (the request append, the response, etc.). A notification can throw for
 * reasons unrelated to that write — `requireUser(request.from)` rejects if the
 * requester has since been removed, and the MDX render / SMTP send can fail
 * transiently. Letting such an error reject the surrounding mutation makes a
 * committed write look failed: the client shows a failure toast, leaves the
 * composer open, and on retry either appends a duplicate comment or trips a
 * status conflict. We swallow and log here so the transport never dictates the
 * outcome of the mutation.
 *
 * Usage: `await safeNotify(() => services.notification.notifyRequestUpdate(request, entry))`.
 */
export async function safeNotify(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error("Best-effort notification failed:", error);
  }
}
