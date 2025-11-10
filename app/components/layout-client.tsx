"use client";

import { CurrentModeDisplay, Navigation } from "./navigation";
import { QueryProvider } from "./query-provider";

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <CurrentModeDisplay />
      <Navigation />
      {children}
    </QueryProvider>
  );
}

