"use client";

import { useState } from "react";
import {
  BaseRequestForm,
  type BaseRequestFormSchema,
} from "./base-request-form";
import { DeadlineExtensionRequestForm } from "./request-form-deadline-extension";
import { SwapSectionRequestForm } from "./request-form-swap-section";

type Step = "base" | "meta" | "details";

export default function Home() {
  const [step, setStep] = useState<Step>("base");
  const [baseData, setBaseData] = useState<BaseRequestFormSchema | null>(null);

  function Form() {
    switch (step) {
      case "base":
        return (
          <BaseRequestForm
            onSubmit={(data) => {
              setBaseData(data);
              setStep("meta");
            }}
          />
        );
      case "meta":
        if (!baseData) {
          return <div>Error: Missing base data</div>;
        }
        switch (baseData.type) {
          case "Swap Section":
            return <SwapSectionRequestForm dataBase={baseData} />;
          case "Deadline Extension":
            return <DeadlineExtensionRequestForm dataBase={baseData} />;
          default:
            return null;
        }
      case "details":
        return <div>Details</div>;
    }
  }

  return (
    <article className="max-w-4xl mx-auto flex flex-col items-center justify-center h-screen">
      <h2>New Request</h2>
      <Form />
    </article>
  );
}
