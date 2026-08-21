"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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


export const ExaminationRow = z.object({
  code: Course.shape.examinations.keyType,
  ...Course.shape.examinations.valueType.shape,
});

export type ExaminationRow = z.infer<typeof ExaminationRow>;

export const columns: ColumnDef<ExaminationRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
  },
  {
    id: "questionsCount",
    header: "Questions Assigned",
    cell: ({ row }) => {
      const questions = row.original.questions;
      if (!questions || questions.length === 0) return "No questions assigned";
      return `${questions.length} questions`;
    },
  },
];

interface ExaminationTableProps {
  examinations: ExaminationRow[];
  onClickRow: (examination: ExaminationRow) => void;
}

export function ExaminationTable({
  examinations,
  onClickRow,
}: ExaminationTableProps) {
  const table = useReactTable({
    data: examinations,
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
                No examinations found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}