"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setSimpleMode, setLoopMode, setScriptMode, setClaudeMode } from "../lib/actions";

async function fetchLEDState() {
    const response = await fetch("/api/control");
    if (!response.ok) {
        throw new Error("Failed to fetch LED state");
    }
    return response.json();
}

export function useLEDState() {
    const queryClient = useQueryClient();

    const { data: state, isLoading } = useQuery({
        queryKey: ["ledState"],
        queryFn: fetchLEDState,
    });

    return {
        loading: isLoading,
        state: state,
        // Convenience functions for mode changes
        setSimpleMode: async (options?: { on?: boolean; color?: string }) => {
            await setSimpleMode(options);
            await queryClient.invalidateQueries({ queryKey: ["ledState"] });
        },
        setLoopMode: async (options?: { colors?: string[]; delay?: number }) => {
            await setLoopMode(options);
            await queryClient.invalidateQueries({ queryKey: ["ledState"] });
        },
        setScriptMode: async (options?: { framerate?: number; frames?: string[] }) => {
            await setScriptMode(options);
            await queryClient.invalidateQueries({ queryKey: ["ledState"] });
        },
        setClaudeMode: async () => {
            await setClaudeMode();
            await queryClient.invalidateQueries({ queryKey: ["ledState"] });
        },
    };
}

