"use client"

import type React from "react";
import { createContext, useContext } from "react";

const ClientServerUrlContext = createContext<string>("");

export function ClientServerUrlProvider({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <ClientServerUrlContext.Provider value={url}>
      {children}
    </ClientServerUrlContext.Provider>
  );
}

export function useClientServerUrl() {
  const ctx = useContext(ClientServerUrlContext);
  return ctx;
}