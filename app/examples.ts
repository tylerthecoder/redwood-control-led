// Preset generators for LED animations

const NUM_LEDS = 60;
const FRAMERATE = 60;

export interface ScriptPreset {
    name: string;
    description: string;
    framerate: number;
    category: string;
    generate: () => string[];
}

export interface LoopPreset {
    name: string;
    description: string;
    colors: string[];
    delay: number;
}

export interface SimplePreset {
    name: string;
    description: string;
    color: string;
}

// ============================================================================
// SCRIPT PRESETS (Custom Animations)
// ============================================================================

// AI Pulse - Breathing effect representing AI thinking
export const aiPulsePreset: ScriptPreset = {
    name: "AI Pulse",
    description: "A gentle breathing pulse from deep blue to bright cyan, like an AI thinking",
    category: "AI",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 4;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;
        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            // Sine wave for smooth breathing effect (0 to 1 and back)
            const progress = Math.sin((frameNum / TOTAL_FRAMES) * Math.PI * 2);
            const brightness = (progress + 1) / 2; // Convert to 0-1 range

            // Interpolate between deep blue and cyan
            const r = Math.floor(0 + (0 * brightness));
            const g = Math.floor(100 + (155 * brightness));
            const b = Math.floor(200 + (55 * brightness));

            const color = rgbToHex(r, g, b);
            const colors: string[] = Array(NUM_LEDS).fill(color);
            frames.push(colors.join(","));
        }

        return frames;
    },
};

// Neural Network - Multiple speeds representing parallel processing
export const neuralNetworkPreset: ScriptPreset = {
    name: "Neural Network",
    description: "Multiple information streams flowing at different speeds, like neural connections",
    category: "AI",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 10;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;

        // Three "neurons" with different colors and speeds
        const neurons = [
            { color: "#00FFFF", speed: 1.2 },   // Cyan - fast
            { color: "#FF00FF", speed: 0.8 },   // Magenta - medium
            { color: "#FFFF00", speed: 0.5 },   // Yellow - slow
        ];

        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            // Track which neurons are at each LED position
            const ledLights: string[][] = Array(NUM_LEDS).fill(null).map(() => []);

            // Calculate position for each neuron
            for (const neuron of neurons) {
                const position = (frameNum * neuron.speed) % NUM_LEDS;
                const ledIndex = Math.floor(position);
                ledLights[ledIndex].push(neuron.color);
            }

            // Generate colors for each LED, averaging if multiple neurons overlap
            const colors: string[] = [];
            for (let ledIndex = 0; ledIndex < NUM_LEDS; ledIndex++) {
                if (ledLights[ledIndex].length > 0) {
                    colors.push(averageColors(ledLights[ledIndex]));
                } else {
                    colors.push("#000000");
                }
            }

            frames.push(colors.join(","));
        }

        return frames;
    },
};

// Red and Green Animation - 10 seconds
export const redGreenPreset: ScriptPreset = {
    name: "Split Colors",
    description: "First 30 LEDs red, last 30 LEDs green",
    category: "Basic",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 10;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;
        const RED = "#FF0000";
        const GREEN = "#00FF00";

        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            const colors: string[] = [];
            // First 30 LEDs: red
            for (let i = 0; i < 30; i++) {
                colors.push(RED);
            }
            // Last 30 LEDs: green
            for (let i = 0; i < 30; i++) {
                colors.push(GREEN);
            }
            frames.push(colors.join(","));
        }

        return frames;
    },
};

// Ring Animation - single light moving around
export const ringPreset: ScriptPreset = {
    name: "Chase",
    description: "Single light moving around the ring",
    category: "Basic",
    framerate: 60,
    generate: () => {
        const ON_COLOR = "#FFFFFF";
        const OFF_COLOR = "#000000";

        const frames: string[] = [];

        // Generate frames for one complete rotation (60 frames for 60 LEDs)
        for (let frameNum = 0; frameNum < NUM_LEDS; frameNum++) {
            const colors: string[] = [];

            for (let ledIndex = 0; ledIndex < NUM_LEDS; ledIndex++) {
                // Turn on the LED at the current position, all others off
                if (ledIndex === frameNum) {
                    colors.push(ON_COLOR);
                } else {
                    colors.push(OFF_COLOR);
                }
            }

            frames.push(colors.join(","));
        }

        return frames;
    },
};

// Helper function to parse hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
    const cleaned = hex.replace("#", "");
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return [r, g, b];
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Helper function to average multiple colors
function averageColors(colorHexes: string[]): string {
    if (colorHexes.length === 0) return "#000000";
    if (colorHexes.length === 1) return colorHexes[0];

    const rgbs = colorHexes.map(hexToRgb);
    const totalR = rgbs.reduce((sum, [r]) => sum + r, 0);
    const totalG = rgbs.reduce((sum, [, g]) => sum + g, 0);
    const totalB = rgbs.reduce((sum, [, , b]) => sum + b, 0);
    const count = rgbs.length;

    return rgbToHex(totalR / count, totalG / count, totalB / count);
}

// Multi-Ring Animation - 4 lights moving at different speeds
export const multiRingPreset: ScriptPreset = {
    name: "Rainbow Chase",
    description: "Multiple colored lights moving at different speeds with color blending",
    category: "Advanced",
    framerate: 60,
    generate: () => {
        const DURATION_SECONDS = 10;
        const TOTAL_FRAMES = FRAMERATE * DURATION_SECONDS;

        // 4 lights with different colors and speeds
        const lights = [
            { color: "#FF0000", speed: 1.0 },      // Red - 1 LED per frame (fastest)
            { color: "#00FF00", speed: 0.5 },     // Green - 0.5 LEDs per frame
            { color: "#0000FF", speed: 0.33 },    // Blue - 0.33 LEDs per frame
            { color: "#FFFF00", speed: 0.25 },    // Yellow - 0.25 LEDs per frame (slowest)
        ];

        const frames: string[] = [];

        for (let frameNum = 0; frameNum < TOTAL_FRAMES; frameNum++) {
            // Track which lights are at each LED position
            const ledLights: string[][] = Array(NUM_LEDS).fill(null).map(() => []);

            // Calculate position for each light
            for (const light of lights) {
                // Calculate current position (wrapping around the ring)
                const position = (frameNum * light.speed) % NUM_LEDS;
                const ledIndex = Math.floor(position);

                // Add this light's color to the LED at this position
                ledLights[ledIndex].push(light.color);
            }

            // Generate colors for each LED, averaging if multiple lights overlap
            const colors: string[] = [];
            for (let ledIndex = 0; ledIndex < NUM_LEDS; ledIndex++) {
                if (ledLights[ledIndex].length > 0) {
                    colors.push(averageColors(ledLights[ledIndex]));
                } else {
                    colors.push("#000000"); // Black if no light
                }
            }

            frames.push(colors.join(","));
        }

        return frames;
    },
};

// ============================================================================
// LOOP PRESETS
// ============================================================================

export const loopPresets: LoopPreset[] = [
    {
        name: "Warm Sunset",
        description: "Warm colors fading like a sunset",
        colors: ["#FF4500", "#FF6347", "#FFD700"],
        delay: 1500,
    },
    {
        name: "Ocean Waves",
        description: "Cool blues and teals like ocean water",
        colors: ["#000080", "#0080FF", "#00CED1", "#40E0D0"],
        delay: 2000,
    },
    {
        name: "Forest",
        description: "Calming green tones",
        colors: ["#228B22", "#32CD32", "#90EE90", "#00FF00"],
        delay: 1800,
    },
    {
        name: "Party Mode",
        description: "Vibrant colors for maximum energy",
        colors: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#8B00FF"],
        delay: 500,
    },
    {
        name: "Chill Vibes",
        description: "Relaxing purple and pink tones",
        colors: ["#9370DB", "#DDA0DD", "#FF1493", "#4B0082"],
        delay: 2500,
    },
    {
        name: "Fire",
        description: "Hot reds and oranges like flickering flames",
        colors: ["#8B0000", "#FF0000", "#FF4500", "#FFA500"],
        delay: 800,
    },
    {
        name: "Ice",
        description: "Cool whites and blues",
        colors: ["#E0FFFF", "#AFEEEE", "#87CEEB", "#4682B4"],
        delay: 2000,
    },
    {
        name: "Neon City",
        description: "Bright cyberpunk colors",
        colors: ["#FF00FF", "#00FFFF", "#FFFF00", "#FF0080"],
        delay: 1000,
    },
];

// ============================================================================
// SIMPLE COLOR PRESETS
// ============================================================================

export const simplePresets: SimplePreset[] = [
    // Primary Colors
    { name: "Red", description: "Classic red", color: "#FF0000" },
    { name: "Green", description: "Classic green", color: "#00FF00" },
    { name: "Blue", description: "Classic blue", color: "#0000FF" },

    // Secondary Colors
    { name: "Yellow", description: "Bright yellow", color: "#FFFF00" },
    { name: "Cyan", description: "Bright cyan", color: "#00FFFF" },
    { name: "Magenta", description: "Bright magenta", color: "#FF00FF" },

    // Warm Tones
    { name: "Orange", description: "Warm orange", color: "#FFA500" },
    { name: "Coral", description: "Soft coral", color: "#FF7F50" },
    { name: "Gold", description: "Golden glow", color: "#FFD700" },

    // Cool Tones
    { name: "Purple", description: "Royal purple", color: "#800080" },
    { name: "Indigo", description: "Deep indigo", color: "#4B0082" },
    { name: "Teal", description: "Ocean teal", color: "#008080" },

    // Pastels
    { name: "Lavender", description: "Soft lavender", color: "#E6E6FA" },
    { name: "Mint", description: "Fresh mint", color: "#98FF98" },
    { name: "Peach", description: "Gentle peach", color: "#FFDAB9" },

    // Neutrals
    { name: "White", description: "Pure white", color: "#FFFFFF" },
    { name: "Warm White", description: "Cozy warm white", color: "#FFF8DC" },
    { name: "Off", description: "Lights off", color: "#000000" },
];

// ============================================================================
// EXPORTS
// ============================================================================

export const scriptPresets: ScriptPreset[] = [
    aiPulsePreset,
    neuralNetworkPreset,
    redGreenPreset,
    ringPreset,
    multiRingPreset,
];

