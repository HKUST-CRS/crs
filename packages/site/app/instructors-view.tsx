"use client";

import { useRouter } from "next/navigation";
import { Requests } from "@/components/_test-data";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";

export default function InstructorsView() {
  const router = useRouter();
  return (
    <article className="mx-auto my-32 flex max-w-4xl flex-col gap-8 lg:my-64">
      <header className="text-center">
        <h1>CRS</h1>
        <TextType
          text="CSE Request System"
          as="div"
          textColors={["#000000"]}
          cursorCharacter="_"
          variableSpeed={{
            min: 120,
            max: 240,
          }}
        />
        <div className="text-gray-500 text-xs">(Instructors' View)</div>
      </header>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">
          Received Requests
        </p>
        <DataTable
          columns={columns}
          data={Requests}
          onClick={(request) => {
            router.push(`/response/${request.id}`);
          }}
        />
      </section>
    </article>
  );
}
