"use client";

import { useQuery } from "@tanstack/react-query";
import type { AppealRole } from "service/models";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

const ROLE_LABEL: Record<AppealRole, string> = {
  admin: "Admin",
  instructor: "Instructor",
  observer: "Observer",
  student: "Student",
  ta: "TA",
  lecturer: "Lecturer",
};

export function AppealParticipants({ appealID }: { appealID: string }) {
  const trpc = useTRPC();
  const participantsQuery = useQuery(
    trpc.appeal.getParticipants.queryOptions(appealID),
  );
  const participants = participantsQuery.data;

  if (participants === undefined) return <Spinner variant="ellipsis" />;
  if (participants.length === 0) {
    return <p className="px-4 text-gray-500">No participants.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 px-4">
      {participants.map((participant) => (
        <li
          key={participant.email}
          className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
        >
          <div className="min-w-0">
            <div className="font-medium">{participant.name}</div>
            <a
              href={`mailto:${participant.email}`}
              className="truncate text-gray-500 text-sm underline"
            >
              {participant.email}
            </a>
          </div>
          <span className="shrink-0 rounded-full border px-2 py-0.5 font-medium text-xs">
            {ROLE_LABEL[participant.role]}
          </span>
        </li>
      ))}
    </ul>
  );
}
