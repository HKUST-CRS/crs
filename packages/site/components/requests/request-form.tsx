"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { isEqual } from "es-toolkit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Request } from "service/models";
import { toast } from "sonner";
import z from "zod";
import { useTRPC } from "@/lib/trpc-client";
import {
  BaseRequestForm,
  type BaseRequestFormSchema,
} from "./base-request-form";
import {
  AbsentFromSectionFormSchema,
  AbsentFromSectionRequestForm,
} from "./request-form-absent-from-section";
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
  AbsentFromSectionFormSchema,
]);
type MetaFormSchema = z.infer<typeof MetaFormSchema>;

export default function RequestForm(props: RequestFormProps) {
  const { viewonly = false } = props;

  const router = useRouter();

  const trpc = useTRPC();
  const createRequest = useMutation(trpc.request.create.mutationOptions());

  const [base, setBase] = useState<BaseRequestFormSchema | null>(
    props.default ?? null,
  );
  const [meta, setMeta] = useState<MetaFormSchema | null>(null);

  async function onSubmit(meta: MetaFormSchema) {
    console.log({ message: "Submit Request", meta, base });

    async function mutate(): Promise<string> {
      if (!base) {
        throw new Error("base is undefined");
      }
      setMeta(meta);
      switch (meta.type) {
        case "Swap Section": {
          return await createRequest.mutateAsync({
            class: base.class,
            type: meta.type,
            details: meta.details,
            metadata: meta.meta,
          });
        }
        case "Absent from Section": {
          return await createRequest.mutateAsync({
            class: base.class,
            type: meta.type,
            details: meta.details,
            metadata: meta.meta,
          });
        }
        case "Deadline Extension": {
          return await createRequest.mutateAsync({
            class: base.class,
            type: meta.type,
            details: meta.details,
            metadata: meta.meta,
          });
        }
      }
    }
    toast.promise(mutate(), {
      loading: "Submitting the request...",
      success: (id) => {
        console.log({ message: "Submitted Request", id });
        router.replace(`/request/${id}`);
        return "Request submitted successfully!";
      },
      error: (err) => `Cannot submit the request: ${err.message}`,
    });
  }

  const MetaForm = () => {
    if (base) {
      switch (base.type) {
        case "Swap Section": {
          const defMeta = meta?.type === "Swap Section" ? meta : undefined;
          const defProps =
            props.default?.type === "Swap Section"
              ? {
                  type: base.type,
                  meta: props.default?.metadata,
                  details: props.default?.details,
                }
              : undefined;
          return (
            <SwapSectionRequestForm
              base={base}
              default={defMeta ?? defProps}
              viewonly={viewonly}
              onSubmit={onSubmit}
            />
          );
        }
        case "Absent from Section": {
          const defMeta =
            meta?.type === "Absent from Section" ? meta : undefined;
          const defProps =
            props.default?.type === "Absent from Section"
              ? {
                  type: base.type,
                  meta: props.default?.metadata,
                  details: props.default?.details,
                }
              : undefined;
          return (
            <AbsentFromSectionRequestForm
              base={base}
              default={defMeta ?? defProps}
              viewonly={viewonly}
              onSubmit={onSubmit}
            />
          );
        }
        case "Deadline Extension": {
          const defMeta =
            meta?.type === "Deadline Extension" ? meta : undefined;
          const defProps =
            props.default?.type === "Deadline Extension"
              ? {
                  type: base.type,
                  meta: props.default?.metadata,
                  details: props.default?.details,
                }
              : undefined;
          return (
            <DeadlineExtensionRequestForm
              base={base}
              default={defMeta ?? defProps}
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
