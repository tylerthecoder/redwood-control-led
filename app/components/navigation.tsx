"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StateViewer } from "./state-viewer";

export function Header() {
    const pathname = usePathname();

    const navItems = [
        { path: "/simple", label: "Simple" },
        { path: "/loop", label: "Loop" },
        { path: "/scripts", label: "Scripts" },
        { path: "/claude", label: "Claude" },
    ];

    return (
        <header className="w-full bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-8 py-4">
                <div className="flex items-center justify-between gap-8">
                    {/* Title */}
                    <h1 className="text-2xl font-semibold text-black dark:text-zinc-50 whitespace-nowrap">
                        Control LED
                    </h1>

                    {/* Navigation */}
                    <nav className="flex gap-2 flex-1 justify-center">
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
                    </nav>

                    {/* State Viewer */}
                    <div className="whitespace-nowrap">
                        <StateViewer />
                    </div>
                </div>
            </div>
        </header>
    );
}

// Keep old exports for backwards compatibility during transition
export function Navigation() {
    return null;
}

export function CurrentModeDisplay() {
    return null;
}

