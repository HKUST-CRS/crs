"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { DateTime, Duration } from "luxon";
import { Course } from "service/models";
import z from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateTimeFormatter } from "@/lib/datetime";

export const AssignmentRow = z.object({
  code: Course.shape.assignments.keyType,
  ...Course.shape.assignments.valueType.shape,
});

export type AssignmentRow = z.infer<typeof AssignmentRow>;

export const columns: ColumnDef<AssignmentRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "due",
    header: "Due Date",
    cell: ({ row }) => {
      return DateTime.fromISO(row.original.due).toFormat(DateTimeFormatter);
    },
  },
  {
    accessorKey: "maxExtension",
    header: "Max Extension",
    cell: ({ row }) => {
      return Duration.fromISO(row.original.maxExtension)
        .shiftTo("days")
        .toHuman({
          unitDisplay: "short",
        });
    },
  },
];

interface AssignmentTableProps {
  assignments: AssignmentRow[];
  onClickRow: (assignment: AssignmentRow) => void;
}

export function AssignmentTable({
  assignments,
  onClickRow,
}: AssignmentTableProps) {
  const table = useReactTable({
    data: assignments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
                onClick={() => onClickRow(row.original)}
                className="cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No assignments found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
