"use client";

import RequestForm from "../../components/requests/request-form";

export default function Home() {
  return (
    <article className="max-w-4xl mx-auto flex flex-col gap-4 items-center justify-center min-h-screen">
      <h3 className="typo-h3">New Request</h3>
      <RequestForm />
    </article>
  );
}
