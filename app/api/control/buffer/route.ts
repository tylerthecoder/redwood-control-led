// Buffer endpoint - returns a specific buffer by index with next buffer index
// Server controls the buffer sequencing, not the client
import { getLedState } from "../state";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get("index");

    const currentState = getLedState();

    if (currentState.mode !== "script") {
        return Response.json(
            {
                error: "LED state is not in script mode",
                currentMode: currentState.mode,
                message: "Animation may have been changed. Please check current mode."
            },
            { status: 400 }
        );
    }

    const scriptState = currentState;
    const totalBuffers = scriptState.buffers.length;

    if (totalBuffers === 0) {
        return Response.json(
            {
                error: "No buffers available",
                message: "Script mode has no buffers loaded. Upload animation first."
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

    // If index is invalid or out of range, return the first buffer (index 0)
    // This allows automatic wrapping and recovery from desync
    let bufferIndex = 0;
    if (!isNaN(requestedIndex) && requestedIndex >= 0 && requestedIndex < totalBuffers) {
        bufferIndex = requestedIndex;
    }

    const requestedBuffer = scriptState.buffers[bufferIndex] || [];

    // Calculate next buffer index (wrap around)
    const nextBufferIndex = (bufferIndex + 1) % totalBuffers;

    // Convert buffer to hex string for more efficient transfer
    // Format: continuous hex string "FF0000FF0000..." (6 chars per color)
    const hexBuffer = requestedBuffer.map((n: number) => n.toString(16).padStart(6, '0')).join('');

    return Response.json({
        buffer: hexBuffer,  // Hex string instead of number array
        buffer_index: bufferIndex,
        next_buffer_index: nextBufferIndex,
        framerate: scriptState.framerate,
        format: 'hex',  // Indicate format for client
    });
}

