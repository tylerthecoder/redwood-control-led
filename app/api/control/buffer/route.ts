// Buffer endpoint - returns a specific buffer by index with next buffer index
// Server controls the buffer sequencing, not the client
// Handles both script mode and claude mode
import { getBufferData } from "../../../lib/buffer";
import { getLEDStateAsState } from "../../../lib/ledstate";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get("index");

    const currentState = await getLEDStateAsState();

    // Check if in script or claude mode
    if (currentState.mode !== "script" && currentState.mode !== "claude") {
        return Response.json(
            {
                error: "LED state is not in script or claude mode",
                currentMode: currentState.mode,
                message: "Animation may have been changed. Please check current mode."
            },
            { status: 400 }
        );
    }

    if (indexParam === null) {
        return Response.json(
            {
                error: "index parameter is required",
                message: "Please provide ?index=N in the URL"
            },
            { status: 400 }
        );
    }

    const requestedIndex = parseInt(indexParam, 10);

    if (isNaN(requestedIndex)) {
        return Response.json(
            {
                error: "Invalid index parameter",
                message: "Index must be a valid number"
            },
            { status: 400 }
        );
    }

    const bufferData = await getBufferData(requestedIndex);

    if (!bufferData) {
        return Response.json(
            {
                error: "No buffers available",
                message: currentState.mode === "claude"
                    ? "No Claude scripts found. Please wait for Claude to generate a script."
                    : "Script mode has no buffers loaded. Upload animation first."
            },
            { status: 400 }
        );
    }

    return Response.json(bufferData);
}

