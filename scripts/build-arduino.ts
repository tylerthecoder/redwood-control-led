#!/usr/bin/env bun

/**
 * Build script for Arduino code
 * Reads WiFi credentials from .env and replaces them in the .ino file
 *
 * Usage: bun run scripts/build-arduino.ts <output-path>
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const SOURCE_PATH = join(ROOT_DIR, "arduino", "control_led.ino");
const ENV_PATH = join(ROOT_DIR, ".env");

function loadEnv(): { WIFI_SSID: string; WIFI_PASSWORD: string } {
    if (!existsSync(ENV_PATH)) {
        console.error("❌ Error: .env file not found!");
        console.error("Please create a .env file with WIFI_SSID and WIFI_PASSWORD");
        process.exit(1);
    }

    const envContent = readFileSync(ENV_PATH, "utf-8");
    const env: Record<string, string> = {};

    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...valueParts] = trimmed.split("=");
            if (key && valueParts.length > 0) {
                let value = valueParts.join("=").trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                env[key] = value;
            }
        }
    }

    if (!env.WIFI_SSID || !env.WIFI_PASSWORD) {
        console.error("❌ Error: WIFI_SSID and WIFI_PASSWORD must be set in .env");
        process.exit(1);
    }

    return {
        WIFI_SSID: env.WIFI_SSID,
        WIFI_PASSWORD: env.WIFI_PASSWORD,
    };
}

function buildArduino(outputPath: string) {
    console.log("🔨 Building Arduino code...");

    if (!existsSync(SOURCE_PATH)) {
        console.error(`❌ Error: Source file not found: ${SOURCE_PATH}`);
        process.exit(1);
    }

    const { WIFI_SSID, WIFI_PASSWORD } = loadEnv();

    console.log(`📡 WiFi SSID: ${WIFI_SSID}`);
    console.log(`🔑 WiFi Password: ${"*".repeat(WIFI_PASSWORD.length)}`);

    const source = readFileSync(SOURCE_PATH, "utf-8");

    // Replace WiFi credentials using regex to match the const char* declarations
    const output = source
        .replace(
            /const char\* ssid = ".*?";/,
            `const char* ssid = "${WIFI_SSID}";`
        )
        .replace(
            /const char\* password = ".*?";/,
            `const char* password = "${WIFI_PASSWORD}";`
        );

    writeFileSync(outputPath, output, "utf-8");

    console.log(`✅ Generated: ${outputPath}`);
    console.log("🎉 Arduino code is ready to upload!");
}

// Check for path argument
if (process.argv.length < 3) {
    console.error("❌ Error: Output path required");
    console.error("Usage: bun run scripts/build-arduino.ts <output-path>");
    console.error("Example: bun run scripts/build-arduino.ts ./arduino/build/control_led.ino");
    process.exit(1);
}

const outputPath = process.argv[2];
buildArduino(outputPath);

