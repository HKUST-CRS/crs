"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { DateTime } from "luxon";
import type { Request, Response } from "service/models";
import { DateTimeFormatter } from "service/utils/datetime";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export const columns: ColumnDef<Request>[] = [
  {
    accessorKey: "from",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          From
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div className="font-medium">{row.original.type}</div>;
    },
  },
  {
    accessorKey: "course",
    accessorFn: (row) => `${row.class.course.code} (${row.class.course.term})`,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          Course
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    sortingFn: (rowA, rowB) => {
      // Sort:
      // 1. by course code (lexicographically)
      // 2. by term (numerically, descending)
      if (rowA.original.class.course.code !== rowB.original.class.course.code) {
        return rowA.original.class.course.code > rowB.original.class.course.code
          ? 1
          : -1;
      }
      return parseInt(rowA.original.class.course.term, 10) <
        parseInt(rowB.original.class.course.term, 10)
        ? 1
        : -1;
    },
  },
  {
    accessorKey: "time",
    accessorFn: (row) =>
      DateTime.fromISO(row.timestamp).toFormat(DateTimeFormatter),
    sortingFn: (rowA, rowB) => {
      const timeA = DateTime.fromISO(rowA.original.timestamp).toMillis();
      const timeB = DateTime.fromISO(rowB.original.timestamp).toMillis();

      if (timeA === timeB) {
        return 0;
      }

      return timeA > timeB ? 1 : -1;
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "response",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          Decision
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const response = row.original.response;
      return response ? (
        response.decision === "Approve" ? (
          <span>
            <span className="text-green-800">Approve</span>{" "}
            <span>({response.from})</span>
          </span>
        ) : response.decision === "Reject" ? (
          <span>
            <span className="text-red-800">Reject</span>{" "}
            <span>({response.from})</span>
          </span>
        ) : (
          <span>
            <span className="text-yellow-800">Unknown</span>{" "}
            <span>({response.from})</span>
          </span>
        )
      ) : (
        <span className="text-yellow-800">Pending</span>
      );
    },
    sortingFn: (rowA, rowB) => {
      function toStatus(r: Response | null) {
        return r ? (r.decision ? "approved" : "rejected") : "pending";
      }
      return toStatus(rowA.original.response) > toStatus(rowB.original.response)
        ? 1
        : -1;
    },
  },
];
