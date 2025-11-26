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

export const SectionRow = z.object({
  code: Course.shape.sections.keyType,
  ...Course.shape.sections.valueType.shape,
});

export type SectionRow = z.infer<typeof SectionRow>;

export const columns: ColumnDef<SectionRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
  },
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => {
      const schedule = row.original.schedule;
      if (!schedule || schedule.length === 0) return "No schedule";
      return (
        <div className="flex gap-2">
          {schedule.map((s, i) => (
            <div key={`${s.day}-${s.from}-${s.to}-${i}`}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.day % 7]}{" "}
              {s.from} - {s.to}
            </div>
          ))}
        </div>
      );
    },
  },
];

interface SectionTableProps {
  sections: SectionRow[];
  onClickRow: (section: SectionRow) => void;
}

export function SectionTable({ sections, onClickRow }: SectionTableProps) {
  const table = useReactTable({
    data: sections,
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
                No section.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
