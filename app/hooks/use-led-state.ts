"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Mode = "simple" | "loop" | "script";

interface SimpleMode {
    mode: "simple";
    on: boolean;
    color: string;
}

interface LoopMode {
    mode: "loop";
    colors: string[];
    delay: number;
}

interface ScriptMode {
    mode: "script";
    frames?: string[];
    framerate: number;
}

type LedState = SimpleMode | LoopMode | ScriptMode;

async function fetchLEDState(): Promise<LedState> {
    const response = await fetch("/api/control");
    if (!response.ok) {
        throw new Error("Failed to fetch LED state");
    }
    return response.json();
}

async function updateLEDState(state: Partial<LedState>): Promise<LedState> {
    const response = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update LED state");
    }
    return response.json();
}

export function useLEDState() {
    const queryClient = useQueryClient();

    const { data: state, isLoading } = useQuery({
        queryKey: ["ledState"],
        queryFn: fetchLEDState,
    });

    const mutation = useMutation({
        mutationFn: updateLEDState,
        onMutate: async (newState) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["ledState"] });

            // Snapshot previous value
            const previousState = queryClient.getQueryData<LedState>(["ledState"]);

            // Optimistically update
            if (previousState) {
                queryClient.setQueryData<LedState>(["ledState"], {
                    ...previousState,
                    ...newState,
                } as LedState);
            }

            return { previousState };
        },
        onError: (err, newState, context) => {
            // Rollback on error
            if (context?.previousState) {
                queryClient.setQueryData(["ledState"], context.previousState);
            }
            console.error("Error updating LED state:", err);
        },
        onSettled: () => {
            // Refetch after mutation
            queryClient.invalidateQueries({ queryKey: ["ledState"] });
        },
    });

    const updateState = (updates: Partial<LedState>) => {
        mutation.mutate(updates);
    };

    return {
        loading: isLoading || mutation.isPending,
        state: state,
        updateState,
        error: mutation.error,
    };
}

