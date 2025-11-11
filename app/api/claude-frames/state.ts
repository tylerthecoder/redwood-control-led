// Claude frames state management - uses store layer
import {
    saveClaudeFrames,
    getClaudeFrames as getFrames,
    getAllClaudeFrames as getAllFrames,
    getClaudeFramesById as getFramesById,
    getActiveClaudeFrames as getActiveFrames,
    setActiveClaudeFrames as setActiveFrames,
} from "../../lib/store";

export async function updateClaudeFrames(
    name: string,
    description: string,
    frames: string[],
    reasoning: string,
    pythonCode: string,
    setAsActive: boolean = true
): Promise<number> {
    return await saveClaudeFrames(name, description, frames, reasoning, pythonCode, setAsActive);
}

export async function getClaudeFrames() {
    return await getFrames();
}

export async function getAllClaudeFrames() {
    return await getAllFrames();
}

export async function getClaudeFramesById(id: number) {
    return await getFramesById(id);
}

export async function getActiveClaudeFrames() {
    return await getActiveFrames();
}

export async function setActiveClaudeFrames(id: number) {
    return await setActiveFrames(id);
}

