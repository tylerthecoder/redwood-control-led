#include <WiFi.h>  // For ESP32 - use #include <ESP8266WiFi.h> for ESP8266
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// WiFi credentials
const char* ssid = "FBI Van";
const char* password = "Tyler123";

// Server configuration
const char* serverHost = "https://control-led.tylertracy.com";
const char* apiPath = "/api/control";
const char* bufferPath = "/api/control/buffer";

// FastLED configuration
#define LED_PIN 18
#define NUM_LEDS 60
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
CRGB leds[NUM_LEDS];

// Global mode state
String currentMode = "simple";

// Mutex for protecting shared state between main loop and API task
SemaphoreHandle_t stateMutex = NULL;

// API check timing (for background task)
const unsigned long checkInterval = 1000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// SIMPLE MODE
// ============================================================================

// Simple mode state
bool simpleOn = false;
String simpleColor = "#0000FF";

// Setup simple mode
void setupSimpleMode(bool on, String color) {
  // Take mutex to protect shared state
  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    // Check if state actually changed
    if (simpleOn == on && simpleColor == color && currentMode == "simple") {
      Serial.println("[SimpleMode] No changes detected, skipping setup");
      xSemaphoreGive(stateMutex);
      return;
    }

    Serial.println("[SimpleMode] Setting up simple mode...");
    Serial.print("[SimpleMode] ON: ");
    Serial.print(on ? "true" : "false");
    Serial.print(", Color: ");
    Serial.println(color);

    simpleOn = on;
    simpleColor = color;
    currentMode = "simple";
    xSemaphoreGive(stateMutex);
  }

  // Update LEDs immediately
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

// Loop simple mode (called every loop iteration)
void loopSimpleMode() {
  // Simple mode doesn't need continuous updates - LEDs are set once in setup
}

// ============================================================================
// LOOP MODE
// ============================================================================

// Loop mode state
String loopColors[20];
int loopColorCount = 0;
unsigned long loopDelay = 1000;
unsigned long lastLoopUpdate = 0;
int currentLoopIndex = 0;

// Setup loop mode
void setupLoopMode(JsonArray colors, unsigned long delay) {
  bool colorsChanged = false;
  bool modeChanged = false;

  // Take mutex to protect shared state
  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    // Check if state actually changed
    colorsChanged = (colors.size() != loopColorCount);
    if (!colorsChanged) {
      for (int i = 0; i < colors.size() && i < 20; i++) {
        String color = colors[i] | "#FFFFFF";
        if (color != loopColors[i]) {
          colorsChanged = true;
          break;
        }
      }
    }

    bool delayChanged = (delay != loopDelay);
    modeChanged = (currentMode != "loop");

    if (!modeChanged && !colorsChanged && !delayChanged) {
      Serial.println("[LoopMode] No changes detected, skipping setup");
      xSemaphoreGive(stateMutex);
      return;
    }

    Serial.println("[LoopMode] Setting up loop mode...");
    Serial.print("[LoopMode] Colors count: ");
    Serial.print(colors.size());
    Serial.print(", Delay: ");
    Serial.println(delay);

    loopDelay = delay;
    loopColorCount = min((int)colors.size(), 20);

    for (int i = 0; i < loopColorCount; i++) {
      loopColors[i] = colors[i] | "#FFFFFF";
    }

    currentMode = "loop";

    // Reset to first color if colors changed or mode changed
    if (modeChanged || colorsChanged) {
      currentLoopIndex = 0;
      lastLoopUpdate = millis();
    }

    xSemaphoreGive(stateMutex);
  }

  // Display first color immediately if mode/colors changed (outside mutex)
  if (modeChanged || colorsChanged) {
    // Take mutex briefly to read first color
    String firstColor = "#FFFFFF";
    if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
      if (loopColorCount > 0) {
        firstColor = loopColors[0];
      }
      xSemaphoreGive(stateMutex);
    }

    CRGB color = hexToCRGB(firstColor);
    fill_solid(leds, NUM_LEDS, color);
    FastLED.show();
  }

  Serial.print("[LoopMode] Loop mode initialized with ");
  Serial.print(loopColorCount);
  Serial.print(" colors, delay: ");
  Serial.print(loopDelay);
  Serial.println("ms");
}

// Loop loop mode (called every loop iteration)
void loopLoopMode() {
  // Take mutex briefly to read state
  if (xSemaphoreTake(stateMutex, 10 / portTICK_PERIOD_MS) == pdTRUE) {
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
      currentLoopIndex = (currentLoopIndex + 1) % loopColorCount;
      xSemaphoreGive(stateMutex);

      // Update LEDs outside of mutex (FastLED operations can be slow)
      fill_solid(leds, NUM_LEDS, color);
      FastLED.show();
    } else {
      xSemaphoreGive(stateMutex);
    }
  }
}

// ============================================================================
// CUSTOM MODE
// ============================================================================

// Custom mode state
// 0.5 second buffers at 60fps = 30 frames * 60 LEDs = 1800 numbers per buffer
unsigned long formatFrames[1800];  // Current buffer: 30 frames * 60 LEDs = 1800 numbers
unsigned long formatNextFrames[1800];  // Next buffer (loaded in background)
int formatFrameCount = 0;
int formatNextFrameCount = 0;
int formatFramerate = 60;
unsigned long formatFrameDelay = 0;
unsigned long lastFormatFrameUpdate = 0;
int currentFormatFrameIndex = 0;  // Frame index within current buffer
int currentBufferIndex = 0;       // Which buffer we're currently playing
int totalBuffers = 0;              // Total number of buffers in sequence
bool formatBufferLoaded = false;
bool formatNextBufferLoaded = false;
bool formatNextBufferRequested = false;  // Track if we've requested the next buffer

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

// Display a frame from numeric buffer
void displayFormatFrame(int frameIndex) {
  int startIndex = frameIndex * NUM_LEDS;
  for (int i = 0; i < NUM_LEDS; i++) {
    unsigned long color = formatFrames[startIndex + i];
    leds[i] = numberToCRGB(color);
  }
  FastLED.show();
}

// Request a specific buffer by index from the API
bool requestBufferByIndex(int bufferIndex) {
  Serial.print("[CustomMode] Requesting buffer index ");
  Serial.println(bufferIndex);

  WiFiClientSecure client;
  HTTPClient http;

  client.setInsecure();

  String url = String(serverHost) + bufferPath + "?index=" + String(bufferIndex);
  Serial.print("[CustomMode] GET URL: ");
  Serial.println(url);

  http.begin(client, url);
  int httpCode = http.GET();

  Serial.print("[CustomMode] HTTP Response code: ");
  Serial.println(httpCode);

  if (httpCode > 0 && httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(20480);  // 20KB should be enough for a single buffer (~16KB)
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      JsonArray buffer = doc["buffer"];
      int receivedIndex = doc["bufferIndex"] | -1;
      int receivedTotal = doc["totalBuffers"] | 0;

      Serial.print("[CustomMode] Received buffer index ");
      Serial.print(receivedIndex);
      Serial.print(" of ");
      Serial.println(receivedTotal);

      // Update total buffers if we got new info
      if (receivedTotal > 0) {
        if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
          if (totalBuffers == 0 || totalBuffers != receivedTotal) {
            totalBuffers = receivedTotal;
            Serial.print("[CustomMode] Updated total buffers to ");
            Serial.println(totalBuffers);
          }
          xSemaphoreGive(stateMutex);
        }
      }

      // Load the buffer into next buffer slot
      loadFormatBuffer(buffer, formatNextFrames, formatNextFrameCount);

      if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
        formatNextBufferLoaded = (formatNextFrameCount > 0);
        formatNextBufferRequested = false;
        xSemaphoreGive(stateMutex);
      }

      http.end();
      return formatNextFrameCount > 0;
    } else {
      Serial.print("[CustomMode] JSON parsing failed: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.print("[CustomMode] HTTP GET failed. Code: ");
    Serial.print(httpCode);
    Serial.print(", Error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();

  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    formatNextBufferRequested = false;
    xSemaphoreGive(stateMutex);
  }

  return false;
}

// Setup custom mode
void setupCustomMode(int totalBuffersCount, int framerate) {
  bool needsSetup = false;

  // Take mutex to protect shared state
  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    bool modeChanged = (currentMode != "custom");
    needsSetup = modeChanged || !formatBufferLoaded || totalBuffers != totalBuffersCount;

    if (!needsSetup) {
      Serial.println("[CustomMode] Already set up, skipping");
      xSemaphoreGive(stateMutex);
      return;
    }

    Serial.println("[CustomMode] Setting up custom mode...");
    Serial.print("[CustomMode] Total buffers: ");
    Serial.print(totalBuffersCount);
    Serial.print(", Framerate: ");
    Serial.println(framerate);

    currentMode = "custom";
    totalBuffers = totalBuffersCount;
    currentBufferIndex = 0;
    formatNextBufferRequested = false;
    formatFramerate = framerate;
    formatFrameDelay = (1000 + formatFramerate / 2) / formatFramerate;
    xSemaphoreGive(stateMutex);
  }

  // Request buffer 0 to start playing
  Serial.println("[CustomMode] Requesting initial buffer (index 0)...");
  if (requestBufferByIndex(0)) {
    // Copy next buffer to current buffer since requestBufferByIndex loads into formatNextFrames
    if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
      if (formatNextBufferLoaded) {
        for (int i = 0; i < formatNextFrameCount * NUM_LEDS; i++) {
          formatFrames[i] = formatNextFrames[i];
        }
        formatFrameCount = formatNextFrameCount;
        formatNextFrameCount = 0;
        formatBufferLoaded = true;
        formatNextBufferLoaded = false;
        currentFormatFrameIndex = 0;
        lastFormatFrameUpdate = millis();

        Serial.print("[CustomMode] Initial buffer loaded: ");
        Serial.print(formatFrameCount);
        Serial.println(" frames");

        // Display first frame
        xSemaphoreGive(stateMutex);
        displayFormatFrame(0);
      } else {
        xSemaphoreGive(stateMutex);
      }
    }
  } else {
    Serial.println("[CustomMode] WARNING: Failed to load initial buffer!");
  }
}

// Loop custom mode (called every loop iteration)
void loopCustomMode() {
  // Take mutex briefly to read/update state
  if (xSemaphoreTake(stateMutex, 10 / portTICK_PERIOD_MS) == pdTRUE) {
    if (!formatBufferLoaded || formatFrameCount == 0) {
      if (!formatBufferLoaded) {
        Serial.println("[CustomMode] No buffer loaded, waiting...");
      }
      xSemaphoreGive(stateMutex);
      return;
    }

    // Prefetch next buffer if we don't have it and there are multiple buffers
    if (totalBuffers > 1 && !formatNextBufferLoaded && !formatNextBufferRequested) {
      int nextBufferIndex = (currentBufferIndex + 1) % totalBuffers;
      formatNextBufferRequested = true;
      xSemaphoreGive(stateMutex);

      Serial.print("[CustomMode] Prefetching next buffer index ");
      Serial.println(nextBufferIndex);
      requestBufferByIndex(nextBufferIndex);

      // Take mutex again to continue
      xSemaphoreTake(stateMutex, portMAX_DELAY);
    }

    unsigned long currentTime = millis();
    unsigned long timeSinceLastUpdate = currentTime - lastFormatFrameUpdate;

    if (timeSinceLastUpdate >= formatFrameDelay) {
      Serial.print("[CustomMode] Displaying frame ");
      Serial.print(currentFormatFrameIndex);
      Serial.print(" of ");
      Serial.print(formatFrameCount);
      Serial.print(" (buffer ");
      Serial.print(currentBufferIndex);
      Serial.print(" of ");
      Serial.print(totalBuffers);
      Serial.print(", delay: ");
      Serial.print(timeSinceLastUpdate);
      Serial.print("ms, target: ");
      Serial.print(formatFrameDelay);
      Serial.println("ms)");

      lastFormatFrameUpdate = currentTime;

      // Display current frame first
      int frameToDisplay = currentFormatFrameIndex;
      currentFormatFrameIndex++;

      // Check if buffer is complete AFTER incrementing
      int framesPerBuffer = formatFrameCount;
      bool bufferComplete = (currentFormatFrameIndex >= framesPerBuffer);

      xSemaphoreGive(stateMutex);

      // Display frame outside of mutex (FastLED operations can be slow)
      displayFormatFrame(frameToDisplay);

      // If buffer complete, switch immediately (still holding mutex released)
      if (bufferComplete) {
        Serial.println("[CustomMode] Buffer complete!");

        unsigned long switchTime = millis();  // Capture time for consistent timing

        if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
          // Buffer complete, switch to next buffer immediately
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
            formatNextBufferRequested = false;

            // Manually modulo buffer index
            currentBufferIndex = (currentBufferIndex + 1) % totalBuffers;

            Serial.print("[CustomMode] Now playing buffer index ");
            Serial.println(currentBufferIndex);
          } else {
            Serial.println("[CustomMode] No next buffer available, looping current buffer");
            // Still increment buffer index for tracking
            currentBufferIndex = (currentBufferIndex + 1) % totalBuffers;
          }

          // Reset timing and frame index
          currentFormatFrameIndex = 0;
          lastFormatFrameUpdate = switchTime;
          xSemaphoreGive(stateMutex);
        }

        // Display first frame of new buffer immediately (outside mutex)
        displayFormatFrame(0);

        // Also display frame 1 immediately to eliminate pause between buffers
        delay(1);  // Minimal delay for frame 0 visibility
        displayFormatFrame(1);

        // Update state for frame 2 (next frame to display)
        if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
          currentFormatFrameIndex = 2;  // Next frame will be 2
          lastFormatFrameUpdate = millis();  // Reset timing for frame 2
          xSemaphoreGive(stateMutex);
        }
      }
    } else {
      xSemaphoreGive(stateMutex);
    }
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

// Background task to check LED state from API
void apiTask(void *parameter) {
  Serial.println("[API Task] Background API task started");

  while (true) {
    // Wait for WiFi connection
    if (WiFi.status() == WL_CONNECTED) {
      checkLedState();
    } else {
      Serial.println("[API Task] WiFi not connected, skipping API check");
    }

    // Wait for check interval
    vTaskDelay(checkInterval / portTICK_PERIOD_MS);
  }
}

// Check and update LED state from API
void checkLedState() {
  Serial.println("\n[API] Checking LED state...");

  WiFiClientSecure client;
  HTTPClient http;

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

    DynamicJsonDocument doc(40960);  // 40KB to handle buffer JSON with overhead
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String newMode = doc["mode"] | "simple";

      Serial.print("[API] Parsed mode: ");
      Serial.println(newMode);

      // Parse JSON and call appropriate setup function
      if (newMode == "simple") {
        bool newOn = doc["on"] | false;
        String newColor = doc["color"] | "#0000FF";
        setupSimpleMode(newOn, newColor);
      }
      else if (newMode == "loop") {
        JsonArray colors = doc["colors"];
        unsigned long newDelay = doc["delay"] | 1000;
        setupLoopMode(colors, newDelay);
      }
      else if (newMode == "custom") {
        int totalBuffersCount = doc["totalBuffers"] | 0;
        int newFramerate = doc["framerate"] | 60;

        if (totalBuffersCount > 0) {
          setupCustomMode(totalBuffersCount, newFramerate);
        } else {
          Serial.println("[API] Custom mode - No buffers available");
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

// ============================================================================
// MAIN SETUP AND LOOP
// ============================================================================

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

  // Create mutex for protecting shared state
  stateMutex = xSemaphoreCreateMutex();
  if (stateMutex == NULL) {
    Serial.println("[Setup] ERROR: Failed to create state mutex!");
  } else {
    Serial.println("[Setup] State mutex created");
  }

  Serial.println();
  Serial.println("[Setup] Initializing LED state from server...");
  checkLedState();

  // Create background task for API requests
  xTaskCreate(
    apiTask,           // Task function
    "API Task",        // Task name
    8192,             // Stack size (bytes)
    NULL,              // Parameters
    1,                 // Priority (1 = low, higher = more priority)
    NULL               // Task handle
  );
  Serial.println("[Setup] Background API task created");

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

  // Call loop function for current mode (read currentMode with mutex)
  String modeToUse = "simple";
  if (xSemaphoreTake(stateMutex, 10 / portTICK_PERIOD_MS) == pdTRUE) {
    modeToUse = currentMode;
    xSemaphoreGive(stateMutex);
  }

  if (modeToUse == "simple") {
    loopSimpleMode();
  } else if (modeToUse == "loop") {
    loopLoopMode();
  } else if (modeToUse == "custom") {
    loopCustomMode();
  }

  // Small delay to prevent watchdog issues
  delay(10);
}
