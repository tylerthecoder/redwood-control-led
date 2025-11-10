"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLEDState } from "../hooks/use-led-state";
import { StateViewer } from "./state-viewer";

type Mode = "simple" | "loop" | "custom";

export function CurrentModeDisplay() {
    const { state } = useLEDState();
    const currentMode = (state?.mode || "simple") as Mode;

    const modeLabels: Record<Mode, string> = {
        simple: "Simple",
        loop: "Loop",
        custom: "Custom",
    };

    return (
        <div className="w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 py-4 px-8">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                    Control LED
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        Current Mode:
                    </span>
                    <span className="px-4 py-2 rounded-full bg-foreground text-background font-medium">
                        {modeLabels[currentMode]}
                    </span>
                    <StateViewer />
                </div>
            </div>
        </div>
    );
}

export function Navigation() {
    const pathname = usePathname();

    const navItems = [
        { path: "/simple", label: "Simple" },
        { path: "/loop", label: "Loop" },
        { path: "/custom", label: "Custom" },
    ];

    return (
        <nav className="w-full bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800">
            <div className="max-w-4xl mx-auto px-8">
                <div className="flex gap-2 py-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`px-6 py-2 rounded-full transition-colors ${pathname === item.path
                                ? "bg-foreground text-background"
                                : "border border-solid border-black/[.08] dark:border-white/[.145] hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}

