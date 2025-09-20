"use client";

import RequestForm from "../../components/requests/request-form";

export default function Home() {
  return (
    <article className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-screen">
      <h2>New Request</h2>
      <RequestForm />
    </article>
  );
}
