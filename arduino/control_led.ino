#include <WiFi.h>  // For ESP32 - use #include <ESP8266WiFi.h> for ESP8266
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// WiFi credentials
const char* ssid = "FBI Van";
const char* password = "Tyler123";

// Server configuration
const char* serverHost = "https://control-led.tylertracy.com";
const char* apiPath = "/api/control";
const char* completePath = "/api/control/complete";

// FastLED configuration
#define LED_PIN 18
#define NUM_LEDS 60
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
CRGB leds[NUM_LEDS];

// Mode state
String currentMode = "simple";

// Format mode state
// 1 second buffers at 60fps = 60 frames * 60 LEDs = 3600 numbers per buffer
unsigned long formatFrames[3600];  // Current buffer: 60 frames * 60 LEDs = 3600 numbers
unsigned long formatNextFrames[3600];  // Next buffer (loaded in background)
int formatFrameCount = 0;
int formatNextFrameCount = 0;
int formatFramerate = 60;
unsigned long formatFrameDelay = 0;
unsigned long lastFormatFrameUpdate = 0;
int currentFormatFrameIndex = 0;
bool formatBufferLoaded = false;
bool formatNextBufferLoaded = false;

// API check timing
unsigned long lastCheckTime = 0;
const unsigned long checkInterval = 1000;

// Helper function to convert hex color string to CRGB
CRGB hexToCRGB(String hex) {
  hex.replace("#", "");
  if (hex.length() != 6) {
    return CRGB::Black;
  }
  long number = strtol(hex.c_str(), NULL, 16);
  int r = (number >> 16) & 0xFF;
  int g = (number >> 8) & 0xFF;
  int b = number & 0xFF;
  return CRGB(r, g, b);
}

// Convert 24-bit RGB number to CRGB
CRGB numberToCRGB(unsigned long color) {
  int r = (color >> 16) & 0xFF;
  int g = (color >> 8) & 0xFF;
  int b = color & 0xFF;
  return CRGB(r, g, b);
}

// Display a frame from numeric buffer
void displayFormatFrame(int frameIndex) {
  int startIndex = frameIndex * NUM_LEDS;
  for (int i = 0; i < NUM_LEDS; i++) {
    unsigned long color = formatFrames[startIndex + i];
    leds[i] = numberToCRGB(color);
  }
  FastLED.show();
}

// Simple mode state
bool simpleOn = false;
String simpleColor = "#0000FF";

// Handle simple mode
void handleSimpleMode(bool on, String color) {
  Serial.print("[SimpleMode] Updating LEDs - ON: ");
  Serial.print(on ? "true" : "false");
  Serial.print(", Color: ");
  Serial.println(color);

  if (on) {
    CRGB rgbColor = hexToCRGB(color);
    fill_solid(leds, NUM_LEDS, rgbColor);
    Serial.print("[SimpleMode] Set all LEDs to RGB(");
    Serial.print(rgbColor.r);
    Serial.print(", ");
    Serial.print(rgbColor.g);
    Serial.print(", ");
    Serial.print(rgbColor.b);
    Serial.println(")");
  } else {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    Serial.println("[SimpleMode] Set all LEDs to OFF (black)");
  }
  FastLED.show();
}

// Loop mode state
String loopColors[20];
int loopColorCount = 0;
unsigned long loopDelay = 1000;
unsigned long lastLoopUpdate = 0;
int currentLoopIndex = 0;

// Handle loop mode
void handleLoopMode() {
  unsigned long currentTime = millis();
  if (currentTime - lastLoopUpdate >= loopDelay) {
    Serial.print("[LoopMode] Updating to color index ");
    Serial.print(currentLoopIndex);
    Serial.print(" of ");
    Serial.print(loopColorCount);
    Serial.print(" (color: ");
    Serial.print(loopColors[currentLoopIndex]);
    Serial.println(")");

    lastLoopUpdate = currentTime;
    CRGB color = hexToCRGB(loopColors[currentLoopIndex]);
    fill_solid(leds, NUM_LEDS, color);
    FastLED.show();
    currentLoopIndex = (currentLoopIndex + 1) % loopColorCount;
  }
}

// Handle format mode
void handleFormatMode() {
  if (!formatBufferLoaded || formatFrameCount == 0) {
    if (!formatBufferLoaded) {
      Serial.println("[CustomMode] No buffer loaded, waiting...");
    }
    return;
  }

  unsigned long currentTime = millis();
  unsigned long timeSinceLastUpdate = currentTime - lastFormatFrameUpdate;

  if (timeSinceLastUpdate >= formatFrameDelay) {
    Serial.print("[CustomMode] Displaying frame ");
    Serial.print(currentFormatFrameIndex);
    Serial.print(" of ");
    Serial.print(formatFrameCount);
    Serial.print(" (delay: ");
    Serial.print(timeSinceLastUpdate);
    Serial.print("ms, target: ");
    Serial.print(formatFrameDelay);
    Serial.println("ms)");

    lastFormatFrameUpdate = currentTime;
    displayFormatFrame(currentFormatFrameIndex);
    currentFormatFrameIndex++;

    // Check if buffer is complete
    int framesPerBuffer = formatFrameCount;
    if (currentFormatFrameIndex >= framesPerBuffer) {
      Serial.println("[CustomMode] Buffer complete!");

      // Buffer complete, switch to next buffer
      if (formatNextBufferLoaded) {
        Serial.print("[CustomMode] Switching to next buffer (");
        Serial.print(formatNextFrameCount);
        Serial.println(" frames)");

        // Copy next buffer to current buffer
        for (int i = 0; i < formatNextFrameCount * NUM_LEDS; i++) {
          formatFrames[i] = formatNextFrames[i];
        }

        formatFrameCount = formatNextFrameCount;
        formatNextFrameCount = 0;
        formatBufferLoaded = true;
        formatNextBufferLoaded = false;
        currentFormatFrameIndex = 0;

        Serial.println("[CustomMode] Buffer switched, notifying server...");
        // Notify server
        notifyBufferComplete();
      } else {
        Serial.println("[CustomMode] No next buffer available, looping current buffer");
        // No next buffer, loop current buffer
        currentFormatFrameIndex = 0;
      }
    }
  }
}

// Notify server that buffer is complete
void notifyBufferComplete() {
  Serial.println("[CustomMode] Notifying server of buffer completion...");

  WiFiClientSecure client;
  HTTPClient http;

  // Skip certificate validation for now (use client.setInsecure() if needed)
  client.setInsecure();

  String url = String(serverHost) + completePath;
  Serial.print("[CustomMode] POST URL: ");
  Serial.println(url);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"action\":\"completeBuffer\"}";
  Serial.print("[CustomMode] Sending JSON: ");
  Serial.println(json);

  int httpCode = http.POST(json);

  if (httpCode > 0) {
    Serial.print("[CustomMode] Buffer complete notification sent successfully. HTTP code: ");
    Serial.println(httpCode);

    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      Serial.print("[CustomMode] Server response: ");
      Serial.println(response);
    }
  } else {
    Serial.print("[CustomMode] Failed to notify buffer complete. Error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// Load format buffer from JSON array
void loadFormatBuffer(JsonArray bufferArray, unsigned long* targetBuffer, int& frameCount) {
  Serial.print("[CustomMode] Loading buffer from JSON array (size: ");
  Serial.print(bufferArray.size());
  Serial.println(")");

  frameCount = 0;
  int index = 0;
  int loadedCount = 0;

  for (JsonVariant value : bufferArray) {
    if (value.is<unsigned long>()) {
      targetBuffer[index++] = value.as<unsigned long>();
      frameCount++;
      loadedCount++;
    } else {
      Serial.print("[CustomMode] Warning: Skipping non-numeric value at index ");
      Serial.println(index);
    }
  }

  frameCount = frameCount / NUM_LEDS;  // Convert to frame count
  Serial.print("[CustomMode] Loaded ");
  Serial.print(loadedCount);
  Serial.print(" color values = ");
  Serial.print(frameCount);
  Serial.println(" frames");
}

// Check and update LED state from API
void checkLedState() {
  Serial.println("\n[API] Checking LED state...");

  WiFiClientSecure client;
  HTTPClient http;

  // Skip certificate validation for now
  client.setInsecure();

  String url = String(serverHost) + apiPath;
  Serial.print("[API] GET URL: ");
  Serial.println(url);

  http.begin(client, url);
  int httpCode = http.GET();

  Serial.print("[API] HTTP Response code: ");
  Serial.println(httpCode);

  if (httpCode > 0 && httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    Serial.print("[API] Response payload length: ");
    Serial.println(payload.length());
    Serial.print("[API] Response preview (first 200 chars): ");
    Serial.println(payload.substring(0, 200));

    DynamicJsonDocument doc(32768);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String newMode = doc["mode"] | "simple";
      bool modeChanged = (newMode != currentMode);

      Serial.print("[API] Current mode: ");
      Serial.print(currentMode);
      Serial.print(", New mode: ");
      Serial.print(newMode);
      Serial.print(", Mode changed: ");
      Serial.println(modeChanged ? "YES" : "NO");

      if (newMode == "simple") {
        bool newOn = doc["on"] | false;
        String newColor = doc["color"] | "#0000FF";

        if (modeChanged || newOn != simpleOn || newColor != simpleColor) {
          Serial.println("[API] Simple mode state changed - updating...");
          currentMode = "simple";
          simpleOn = newOn;
          simpleColor = newColor;
          handleSimpleMode(simpleOn, simpleColor);
          Serial.print("[API] Simple mode updated - ");
          Serial.print(simpleOn ? "ON" : "OFF");
          Serial.print(" - Color: ");
          Serial.println(simpleColor);
        } else {
          Serial.println("[API] Simple mode - no changes needed");
        }
      }
      else if (newMode == "loop") {
        JsonArray colors = doc["colors"];
        unsigned long newDelay = doc["delay"] | 1000;

        Serial.print("[API] Loop mode - Colors count: ");
        Serial.print(colors.size());
        Serial.print(", Delay: ");
        Serial.println(newDelay);

        bool loopChanged = (colors.size() != loopColorCount);
        if (!loopChanged) {
          for (int i = 0; i < colors.size() && i < 20; i++) {
            String color = colors[i] | "#FFFFFF";
            if (color != loopColors[i]) {
              loopChanged = true;
              Serial.print("[API] Loop color changed at index ");
              Serial.println(i);
              break;
            }
          }
        }

        if (modeChanged || loopChanged || newDelay != loopDelay) {
          Serial.println("[API] Loop mode state changed - updating...");
          currentMode = "loop";
          loopDelay = newDelay;
          loopColorCount = min((int)colors.size(), 20);

          for (int i = 0; i < loopColorCount; i++) {
            loopColors[i] = colors[i] | "#FFFFFF";
          }

          if (modeChanged || loopChanged) {
            Serial.println("[API] Loop mode colors changed - resetting index");
            currentLoopIndex = 0;
            lastLoopUpdate = millis();
            CRGB color = hexToCRGB(loopColors[0]);
            fill_solid(leds, NUM_LEDS, color);
            FastLED.show();
          }

          Serial.print("[API] Loop mode updated - ");
          Serial.print(loopColorCount);
          Serial.print(" colors, delay: ");
          Serial.print(loopDelay);
          Serial.println("ms");
        } else {
          Serial.println("[API] Loop mode - no changes needed");
        }
      }
      else if (newMode == "custom") {
        JsonArray currentBuffer = doc["currentBuffer"];
        JsonArray nextBuffer = doc["nextBuffer"];
        int newFramerate = doc["framerate"] | 60;

        Serial.print("[API] Custom mode - Current buffer size: ");
        Serial.print(currentBuffer.size());
        Serial.print(", Next buffer size: ");
        Serial.print(nextBuffer.size());
        Serial.print(", Framerate: ");
        Serial.println(newFramerate);

        if (modeChanged || !formatBufferLoaded) {
          Serial.println("[API] Custom mode - Loading current buffer...");
          // Load current buffer
          loadFormatBuffer(currentBuffer, formatFrames, formatFrameCount);
          formatBufferLoaded = (formatFrameCount > 0);
          formatFramerate = newFramerate;
          formatFrameDelay = (1000 + formatFramerate / 2) / formatFramerate;
          currentFormatFrameIndex = 0;
          lastFormatFrameUpdate = millis();

          Serial.print("[API] Custom mode - Buffer loaded: ");
          Serial.print(formatFrameCount);
          Serial.print(" frames, framerate: ");
          Serial.print(formatFramerate);
          Serial.print(" fps, frame delay: ");
          Serial.print(formatFrameDelay);
          Serial.println(" ms");

          if (formatBufferLoaded) {
            Serial.println("[API] Custom mode - Displaying first frame");
            displayFormatFrame(0);
          } else {
            Serial.println("[API] Custom mode - WARNING: Buffer failed to load!");
          }
        } else {
          Serial.println("[API] Custom mode - Current buffer already loaded");
        }

        // Load next buffer in background if available
        if (nextBuffer.size() > 0 && !formatNextBufferLoaded) {
          Serial.println("[API] Custom mode - Loading next buffer in background...");
          loadFormatBuffer(nextBuffer, formatNextFrames, formatNextFrameCount);
          formatNextBufferLoaded = (formatNextFrameCount > 0);
          if (formatNextBufferLoaded) {
            Serial.print("[API] Custom mode - Next buffer loaded: ");
            Serial.print(formatNextFrameCount);
            Serial.println(" frames");
          } else {
            Serial.println("[API] Custom mode - WARNING: Next buffer failed to load!");
          }
        } else if (formatNextBufferLoaded) {
          Serial.println("[API] Custom mode - Next buffer already loaded, skipping");
        } else if (nextBuffer.size() == 0) {
          Serial.println("[API] Custom mode - No next buffer available");
        }
      } else {
        Serial.print("[API] WARNING: Unknown mode received: ");
        Serial.println(newMode);
      }
    } else {
      Serial.print("[API] ERROR: JSON parsing failed: ");
      Serial.println(error.c_str());
      Serial.print("[API] Payload that failed: ");
      Serial.println(payload);
    }
  } else {
    Serial.print("[API] ERROR: HTTP GET failed. Code: ");
    Serial.print(httpCode);
    Serial.print(", Error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
  Serial.println("[API] Request complete\n");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println("LED Control System Starting...");
  Serial.println("========================================\n");

  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(80);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  Serial.println("[Setup] FastLED initialized");
  Serial.print("[Setup] LED Pin: ");
  Serial.println(LED_PIN);
  Serial.print("[Setup] Number of LEDs: ");
  Serial.println(NUM_LEDS);
  Serial.print("[Setup] Brightness: ");
  Serial.println(80);

  Serial.println();
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 40) {
      Serial.println("\n[WiFi] ERROR: Connection timeout!");
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] Signal strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n[WiFi] ERROR: Failed to connect!");
  }

  Serial.println();
  Serial.println("[Setup] Initializing LED state from server...");
  checkLedState();

  Serial.println("\n========================================");
  Serial.println("Setup complete. Entering main loop...");
  Serial.println("========================================\n");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost! Reconnecting...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\n[WiFi] Reconnected!");
  }

  // Handle current mode
  if (currentMode == "loop") {
    handleLoopMode();
  } else if (currentMode == "custom") {
    handleFormatMode();
  } else if (currentMode == "simple") {
    // Simple mode doesn't need continuous updates
  }

  // Check API periodically
  unsigned long currentTime = millis();
  if (currentTime - lastCheckTime >= checkInterval) {
    lastCheckTime = currentTime;
    checkLedState();
  }

  delay(50);
}
