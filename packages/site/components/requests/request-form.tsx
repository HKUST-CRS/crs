"use client";

import clsx from "clsx";
import { isEqual } from "es-toolkit";
import { useState } from "react";
import type { Request } from "service/models";
import {
  BaseRequestForm,
  type BaseRequestFormSchema,
} from "./base-request-form";
import { DeadlineExtensionRequestForm } from "./request-form-deadline-extension";
import { SwapSectionRequestForm } from "./request-form-swap-section";

export type RequestFormProps = {
  viewonly?: boolean;
  default?: Request;

  className?: string;
};

export default function RequestForm(props: RequestFormProps) {
  const { viewonly = false } = props;

  const [base, setBase] = useState<BaseRequestFormSchema | null>(
    props.default ?? null,
  );

  const MetaForm = () => {
    if (props.default) {
      switch (props.default.type) {
        case "Swap Section":
          return (
            <SwapSectionRequestForm
              base={props.default}
              default={{
                ...props.default.metadata,
                details: props.default.details,
              }}
              viewonly={viewonly}
            />
          );
        case "Deadline Extension":
          return (
            <DeadlineExtensionRequestForm
              base={props.default}
              default={{
                ...props.default.metadata,
                details: props.default.details,
              }}
              viewonly={viewonly}
            />
          );
      }
    }
    return null;
  };

  return (
    <div
      className={clsx("flex flex-col justify-stretch gap-4", props.className)}
    >
      <BaseRequestForm
        onSubmit={(data) => {
          if (!isEqual(data, base)) {
            setBase(data);
          }
        }}
        default={base ?? undefined}
        viewonly={viewonly}
      />
      <MetaForm />
    </div>
  );
}
