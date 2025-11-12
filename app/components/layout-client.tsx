"use client";

import { Header } from "./navigation";
import { QueryProvider } from "./query-provider";

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <Header />
      {children}
    </QueryProvider>
  );
}

