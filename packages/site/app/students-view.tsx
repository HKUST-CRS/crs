"use client";

import { FilePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Requests } from "@/components/_test-data";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";

export default function StudentsView() {
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
        <div className="text-gray-500 text-xs">(Students' View)</div>
      </header>
      <section className="mx-auto">
        <Link href="/request">
          <Button className="cursor-pointer">
            <FilePlus /> New Request
          </Button>
        </Link>
      </section>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">My Requests</p>
        <DataTable
          columns={columns}
          data={Requests}
          onClick={(request) => {
            router.push(`/request/${request.id}`);
          }}
        />
      </section>
    </article>
  );
}
