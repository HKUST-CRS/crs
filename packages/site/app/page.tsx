import { FilePlus } from "lucide-react";
import Link from "next/link";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <article className="max-w-4xl mx-auto lg:my-64 my-32 flex flex-col gap-8">
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
        <div className="text-xs text-gray-500">(Students' View)</div>
      </header>
      <section className="mx-auto">
        <Link href="/request">
          <Button className="cursor-pointer">
            <FilePlus /> New Request
          </Button>
        </Link>
      </section>
      <section>
        <p className="text-sm leading-none font-medium pb-4">My Requests</p>
        <DataTable columns={columns} data={[]} />
      </section>
    </article>
  );
}
