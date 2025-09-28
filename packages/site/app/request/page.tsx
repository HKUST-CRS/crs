"use client";

import RequestForm from "../../components/requests/request-form";

export default function Home() {
  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <h3 className="typo-h3">New Request</h3>
      <RequestForm />
    </article>
  );
}
