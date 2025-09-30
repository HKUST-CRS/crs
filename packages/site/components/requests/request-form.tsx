"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { isEqual } from "es-toolkit";
import { useState } from "react";
import type { Request } from "service/models";
import z from "zod";
import { useTRPC } from "@/lib/trpc-client";
import {
  BaseRequestForm,
  type BaseRequestFormSchema,
} from "./base-request-form";
import {
  DeadlineExtensionFormSchema,
  DeadlineExtensionRequestForm,
} from "./request-form-deadline-extension";
import {
  SwapSectionFormSchema,
  SwapSectionRequestForm,
} from "./request-form-swap-section";

export type RequestFormProps = {
  viewonly?: boolean;
  default?: Request;

  className?: string;
};

const MetaFormSchema = z.discriminatedUnion("type", [
  SwapSectionFormSchema,
  DeadlineExtensionFormSchema,
]);
type MetaFormSchema = z.infer<typeof MetaFormSchema>;

export default function RequestForm(props: RequestFormProps) {
  const { viewonly = false } = props;

  const trpc = useTRPC();
  const createRequest = useMutation(trpc.request.create.mutationOptions());

  const [base, setBase] = useState<BaseRequestFormSchema | null>(
    props.default ?? null,
  );

  function onSubmit(meta: MetaFormSchema) {
    console.log({ message: "Submit", meta, base });
    if (!base) {
      throw new Error("base is undefined");
    }
    switch (meta.type) {
      case "Swap Section": {
        createRequest.mutate({
          from: "yhliaf@connect.ust.hk",
          course: base.course,
          type: meta.type,
          details: meta.details,
          metadata: meta.meta,
        });
        return;
      }
      case "Deadline Extension": {
        createRequest.mutate({
          from: "yhliaf@connect.ust.hk",
          course: base.course,
          type: meta.type,
          details: meta.details,
          metadata: meta.meta,
        });
        return;
      }
    }
  }

  const MetaForm = () => {
    if (base) {
      switch (base.type) {
        case "Swap Section": {
          const def =
            props.default?.type === "Swap Section"
              ? {
                  type: base.type,
                  meta: props.default.metadata,
                  details: props.default.details,
                }
              : undefined;
          return (
            <SwapSectionRequestForm
              base={base}
              default={def}
              viewonly={viewonly}
              onSubmit={(v) => {
                console.log("request onSubmit");
                onSubmit(v);
                console.log("request onSubmit done");
              }}
            />
          );
        }
        case "Deadline Extension": {
          const def =
            props.default?.type === "Deadline Extension"
              ? {
                  type: base.type,
                  meta: props.default.metadata,
                  details: props.default.details,
                }
              : undefined;
          return (
            <DeadlineExtensionRequestForm
              base={base}
              default={def}
              viewonly={viewonly}
              onSubmit={onSubmit}
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
