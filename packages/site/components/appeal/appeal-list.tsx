"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Courses } from "service/models";
import { formatDateTime } from "service/utils/datetime";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

export function AppealList() {
  const router = useRouter();
  const trpc = useTRPC();

  const appealsQuery = useQuery(trpc.appeal.list.queryOptions());
  const appeals = appealsQuery.data;

  if (appeals === undefined) {
    return <Spinner variant="ellipsis" />;
  }

  if (appeals.length === 0) {
    return <p className="text-gray-500">No appeals yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {appeals.map((appeal) => (
        <li key={appeal.id}>
          <button
            type="button"
            onClick={() => router.push(`/appeal/${appeal.id}`)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span>
              <strong>{Courses.formatID(appeal.course)}</strong> ·{" "}
              {appeal.assignment}
            </span>
            <span className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">
                {formatDateTime(appeal.openedAt)}
              </span>
              <span
                className={
                  appeal.state === "open"
                    ? "font-medium text-green-800 dark:text-green-400"
                    : "text-gray-500"
                }
              >
                {appeal.state}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
