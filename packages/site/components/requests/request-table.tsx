"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import type { Request, Response } from "service/models";
import { formatDateTime, fromISO } from "service/utils/datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface RequestTableProps {
  data: Request[];
  onClick?: (row: Request) => void;
}

const columns: ColumnDef<Request>[] = [
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
    id: "course",
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
    id: "time",
    accessorFn: (row) => formatDateTime(row.timestamp),
    sortingFn: (rowA, rowB) => {
      const timeA = fromISO(rowA.original.timestamp).toMillis();
      const timeB = fromISO(rowB.original.timestamp).toMillis();

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
    id: "decision",
    accessorFn: (row) => {
      return row.response?.decision || "Pending";
    },
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
            <span className="text-green-800 dark:text-green-400">Approve</span>{" "}
            <span>({response.from})</span>
          </span>
        ) : response.decision === "Reject" ? (
          <span>
            <span className="text-red-800 dark:text-red-400">Reject</span>{" "}
            <span>({response.from})</span>
          </span>
        ) : (
          <span>
            <span className="text-yellow-800 dark:text-yellow-400">
              Unknown ({response.decision})
            </span>{" "}
            <span>({response.from})</span>
          </span>
        )
      ) : (
        <span className="text-yellow-800 dark:text-yellow-400">Pending</span>
      );
    },
    sortingFn: (rowA, rowB) => {
      function toStatus(r: Response | null) {
        return r?.decision ?? "pending";
      }
      return toStatus(rowA.original.response) > toStatus(rowB.original.response)
        ? 1
        : -1;
    },
  },
];

export function RequestTable({ data, onClick }: RequestTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "time",
      desc: true,
    },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <Input
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => table.setGlobalFilter(String(e.target.value))}
          className="max-w-full"
        />
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => onClick?.(row.original)}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No requests.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
