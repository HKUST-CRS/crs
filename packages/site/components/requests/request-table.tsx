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
import { sortBy, uniqBy } from "es-toolkit";
import { ArrowUpDown, CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  type CourseID,
  Courses,
  type RequestHead,
  type RequestStatus,
  Terms,
} from "service/models";
import { formatDate, formatDateTime, fromISO } from "service/utils/datetime";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  data: RequestHead[];
  onClick?: (row: RequestHead) => void;
}

export interface RequestTableHandle {
  getExportIDs: () => string[];
}

/** Display label for each lifecycle status in the Status column. */
const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  approved: "Approved",
  rejected: "Rejected",
  appealed: "Appealed",
  cancelled: "Cancelled",
};

/** Sort order for the Status column (open first, cancelled last). */
const STATUS_ORDER: Record<RequestStatus, number> = {
  open: 0,
  appealed: 1,
  approved: 2,
  rejected: 3,
  cancelled: 4,
};

const requestFilter =
  (filterOptions: {
    status: RequestStatus | null;
    term: string | null;
    course: CourseID | null;
    from: DateTime | null;
    to: DateTime | null;
  }) =>
  (request: RequestHead) => {
    if (
      filterOptions.status !== null &&
      request.status !== filterOptions.status
    ) {
      return false;
    }
    if (
      filterOptions.term !== null &&
      filterOptions.term !== request.class.course.term
    ) {
      return false;
    }
    if (
      filterOptions.course !== null &&
      Courses.compare(request.class.course, filterOptions.course) !== 0
    ) {
      return false;
    }

    const timestamp = fromISO(request.timestamp);
    const fromDate = filterOptions.from?.toISODate() ?? null;
    const toDate = filterOptions.to?.toISODate() ?? null;

    if (fromDate !== null && timestamp < fromISO(fromDate).startOf("day")) {
      return false;
    }
    if (toDate !== null && timestamp > fromISO(toDate).endOf("day")) {
      return false;
    }

    return true;
  };

const columns: ColumnDef<RequestHead>[] = [
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
    id: "status",
    accessorFn: (row) => STATUS_LABEL[row.status],
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className={cn(column.getIsSorted() && "underline")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.original.status;
      const label = STATUS_LABEL[status];
      const color =
        status === "approved"
          ? "text-green-800 dark:text-green-400"
          : status === "rejected"
            ? "text-red-800 dark:text-red-400"
            : status === "cancelled"
              ? "text-gray-500 dark:text-gray-400"
              : "text-yellow-800 dark:text-yellow-400";
      return <span className={color}>{label}</span>;
    },
    sortingFn: (rowA, rowB) => {
      const a = STATUS_ORDER[rowA.original.status];
      const b = STATUS_ORDER[rowB.original.status];
      return a === b ? 0 : a > b ? 1 : -1;
    },
  },
];

export const RequestTable = forwardRef<RequestTableHandle, RequestTableProps>(
  function RequestTable({ data: rawData, onClick }: RequestTableProps, ref) {
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
    const [statusFilter, setStatusFilter] = useState<RequestStatus | null>(
      null,
    );
    const [termFilter, setTermFilter] = useState<string | null>(null);
    const [courseFilter, setCourseFilter] = useState<CourseID | null>(null);
    const [fromFilter, setFromFilter] = useState<DateTime | null>(null);
    const [toFilter, setToFilter] = useState<DateTime | null>(null);

    const termOptions = useMemo(() => {
      let terms = rawData.map((request) => request.class.course.term);
      terms = uniqBy(terms, Terms.term2num);
      // @ts-expect-error fuck es-toolkit; it doesn't support string[]
      terms = sortBy(terms, [(term) => -Terms.term2num(term)]);
      return terms;
    }, [rawData]);

    const courseOptions = useMemo(() => {
      let courses = rawData.map((request) => request.class.course);
      courses = uniqBy(courses, Courses.id2str);
      courses = courses.sort(Courses.compare);
      courses = courses.filter(
        (c) => termFilter === null || c.term === termFilter,
      );
      return courses;
    }, [rawData, termFilter]);

    useEffect(() => {
      setTermFilter(termOptions[0] ?? null);
    }, [termOptions]);

    const data = useMemo(
      () =>
        rawData.filter(
          requestFilter({
            status: statusFilter,
            term: termFilter,
            course: courseFilter,
            from: fromFilter,
            to: toFilter,
          }),
        ),
      [rawData, statusFilter, fromFilter, courseFilter, termFilter, toFilter],
    );

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

    useImperativeHandle(
      ref,
      () => ({
        getExportIDs: () =>
          table.getSortedRowModel().rows.map((row) => row.original.id),
      }),
      [table],
    );

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field className="col-span-1">
            <FieldLabel>Status</FieldLabel>
            <Select
              value={statusFilter ?? "__all"}
              onValueChange={(value) => {
                setStatusFilter(
                  value === "__all" ? null : (value as RequestStatus),
                );
              }}
              disabled={!termOptions.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-1">
            <FieldLabel>Term</FieldLabel>
            <Select
              value={termFilter ?? "__all"}
              onValueChange={(value) => {
                setTermFilter(value === "__all" ? null : value);
              }}
              disabled={!termOptions.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All terms</SelectItem>
                {termOptions.map((term) => (
                  <SelectItem key={term} value={term}>
                    {Terms.formatTerm(term)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="col-span-2">
            <FieldLabel>Course</FieldLabel>
            <Select
              value={courseFilter ? Courses.id2str(courseFilter) : "__all"}
              onValueChange={(value) => {
                setCourseFilter(
                  value === "__all" ? null : Courses.str2id(value),
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All courses</SelectItem>
                {courseOptions.map((course) => (
                  <SelectItem
                    key={Courses.id2str(course)}
                    value={Courses.id2str(course)}
                  >
                    {Courses.formatID(course)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>From</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromFilter ? (
                    formatDate(fromFilter)
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fromFilter ? fromFilter.toJSDate() : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setFromFilter(DateTime.fromJSDate(date));
                    } else {
                      setFromFilter(null);
                    }
                  }}
                  className="rounded-lg border shadow-sm"
                />
              </PopoverContent>
            </Popover>
          </Field>

          <Field>
            <FieldLabel>To</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toFilter ? formatDate(toFilter) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={toFilter ? toFilter.toJSDate() : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setToFilter(DateTime.fromJSDate(date));
                    } else {
                      setToFilter(null);
                    }
                  }}
                  className="rounded-lg border shadow-sm"
                />
              </PopoverContent>
            </Popover>
          </Field>
        </div>

        <div className="mt-2 overflow-hidden rounded-md border">
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
  },
);
