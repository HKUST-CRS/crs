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
    if (base) {
      switch (base.type) {
        case "Swap Section": {
          const def =
            props.default?.type === "Swap Section"
              ? {
                  ...props.default.metadata,
                  details: props.default.details,
                }
              : undefined;
          return (
            <SwapSectionRequestForm
              base={base}
              default={def}
              viewonly={viewonly}
            />
          );
        }
        case "Deadline Extension": {
          const def =
            props.default?.type === "Deadline Extension"
              ? {
                  ...props.default.metadata,
                  details: props.default.details,
                }
              : undefined;
          return (
            <DeadlineExtensionRequestForm
              base={base}
              default={def}
              viewonly={viewonly}
            />
          );
        }
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
