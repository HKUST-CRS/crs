import { NavigationCard } from "@/components/navigation-card";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";

export default function Home() {
  return (
    <article className="max-w-4xl mx-auto my-64 flex flex-col gap-8">
      <header className="text-center">
        <h1>CRS</h1>
        <div>CSE Request System</div>
        <div className="text-xs text-gray-500">(Students' View)</div>
      </header>
      <section className="grid grid-cols-2 gap-4 mx-16">
        <NavigationCard
          title={"Lab Requests"}
          description={
            <>
              For <em>Lab Swap</em>, <em>Lab Absent</em>, and{" "}
              <em>Lab Deadline Extension</em> requests...
            </>
          }
          target={""}
        />
        <NavigationCard
          title={"Assignment Requests"}
          description={
            <>
              For <em>Assignment Appeal</em> and{" "}
              <em>Assignment Deadline Extension</em> requests...
            </>
          }
          target={""}
        />
        <NavigationCard
          title={"Exam Requests"}
          description={
            <>
              For <em>Exam Reschedule (Make-up)</em> and <em>Exam Absence</em>{" "}
              requests...
            </>
          }
          target={""}
        />
        <NavigationCard
          title={"Others"}
          description={
            <>
              For <em>Checking Exam Score for Each Questions</em>,{" "}
              <em>Checking Seating Plan</em>...
            </>
          }
          target={""}
        />
      </section>
      <section>
        <p className="text-sm leading-none font-medium pb-4">My Requests</p>
        <DataTable columns={columns} data={[]} />
      </section>
    </article>
  );
}
