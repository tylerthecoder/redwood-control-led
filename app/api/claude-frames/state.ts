// Claude frames state management - uses store layer
import { saveClaudeFrames, getClaudeFrames as getFrames } from "../../lib/store";

export async function updateClaudeFrames(
    frames: string[],
    reasoning: string,
    pythonCode: string
): Promise<void> {
    await saveClaudeFrames(frames, reasoning, pythonCode);
}

export async function getClaudeFrames() {
    return await getFrames();
}

