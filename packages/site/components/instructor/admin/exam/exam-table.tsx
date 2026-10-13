"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Exam } from "service/models";
import z from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const ExamRow = z.object({
  code: z.string().trim().min(1),
  ...Exam.shape,
});

export type ExamRow = z.infer<typeof ExamRow>;

export const columns: ColumnDef<ExamRow>[] = [
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
      return `${questions.length} ${questions.length === 1 ? "question" : "questions"}`;
    },
  },
];

interface ExamTableProps {
  exams: ExamRow[];
  onClickRow: (exam: ExamRow) => void;
}

export function ExamTable({ exams, onClickRow }: ExamTableProps) {
  const table = useReactTable({
    data: exams,
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
                    {cell.column.id === "code" ? (
                      <button
                        type="button"
                        aria-label={`Edit exam ${row.original.code}`}
                        className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClickRow(row.original);
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </button>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No exams found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
