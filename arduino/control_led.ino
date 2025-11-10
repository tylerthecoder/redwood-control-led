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
#define LED_BRIGHTNESS 80
CRGB leds[NUM_LEDS];

// Configuration constants
const int MAX_LOOP_COLORS = 20;
const int MAX_BUFFER_COLORS = 1800;  // 30 frames * 60 LEDs at 60fps for 0.5s
const int JSON_DOC_SIZE_BUFFER = 20480;  // 20KB for buffer responses
const int JSON_DOC_SIZE_ERROR = 1024;    // 1KB for error responses
const int JSON_DOC_SIZE_API = 40960;     // 40KB for API state responses
const int MUTEX_TIMEOUT_MS = 10;
const unsigned long API_CHECK_INTERVAL_MS = 1000;
const unsigned long BUFFER_FETCH_INTERVAL_MS = 20;
const int TLS_HANDSHAKE_TIMEOUT_SEC = 10;

// Global mode state
String currentMode = "simple";

// Mutex for protecting shared state between main loop and API task
SemaphoreHandle_t stateMutex = NULL;

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
String loopColors[MAX_LOOP_COLORS];
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
    loopColorCount = min((int)colors.size(), MAX_LOOP_COLORS);

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
  if (xSemaphoreTake(stateMutex, MUTEX_TIMEOUT_MS / portTICK_PERIOD_MS) == pdTRUE) {
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
// SCRIPT MODE
// ============================================================================

// Script mode state
// 0.5 second buffers at 60fps = 30 frames * 60 LEDs = MAX_BUFFER_COLORS numbers per buffer
unsigned long formatFrames[MAX_BUFFER_COLORS];  // Current buffer
unsigned long formatNextFrames[MAX_BUFFER_COLORS];  // Next buffer (loaded in background)
int formatFrameCount = 0;
int formatNextFrameCount = 0;
int formatFramerate = 60;
unsigned long formatFrameDelay = 0;
unsigned long lastFormatFrameUpdate = 0;
int currentFormatFrameIndex = 0;  // Frame index within current buffer
int currentBufferIndex = 0;       // Which buffer we're currently playing
int nextBufferIndex = 1;          // Which buffer to fetch next (server-controlled)
bool formatBufferLoaded = false;
bool formatNextBufferLoaded = false;

// Buffer fetch task communication
int bufferToFetch = -1;           // Which buffer index to fetch (-1 = none)
bool bufferFetchPending = false;  // Whether a fetch request is pending

// Persistent HTTP client for buffer fetches (reuses connection)
WiFiClientSecure persistentBufferClient;
HTTPClient persistentBufferHttp;
bool persistentBufferClientInitialized = false;

// Helper function to copy buffer data
void copyBuffer(unsigned long* dest, unsigned long* src, int frameCount) {
  int totalColors = frameCount * NUM_LEDS;
  for (int i = 0; i < totalColors; i++) {
    dest[i] = src[i];
  }
}

// Load format buffer from hex string (optimized format)
void loadFormatBufferFromHex(String hexString, unsigned long* targetBuffer, int& frameCount) {
  Serial.print("[ScriptMode] Loading buffer from hex string (length: ");
  Serial.print(hexString.length());
  Serial.println(")");

  frameCount = 0;
  int index = 0;
  int hexLength = hexString.length();

  // Each color is 6 hex characters (RRGGBB)
  for (int pos = 0; pos < hexLength && index < MAX_BUFFER_COLORS; pos += 6) {
    if (pos + 6 <= hexLength) {
      // Extract 6-character hex string and convert to number
      String hexColor = hexString.substring(pos, pos + 6);
      unsigned long color = strtoul(hexColor.c_str(), NULL, 16);
      targetBuffer[index++] = color;
      frameCount++;
    }
  }

  frameCount = frameCount / NUM_LEDS;  // Convert to frame count
  Serial.print("[ScriptMode] Loaded ");
  Serial.print(index);
  Serial.print(" color values = ");
  Serial.print(frameCount);
  Serial.println(" frames");
}

// Load format buffer from JSON array (legacy format, kept for compatibility)
void loadFormatBufferFromArray(JsonArray bufferArray, unsigned long* targetBuffer, int& frameCount) {
  Serial.print("[ScriptMode] Loading buffer from JSON array (size: ");
  Serial.print(bufferArray.size());
  Serial.println(")");

  frameCount = 0;
  int index = 0;
  int loadedCount = 0;

  for (JsonVariant value : bufferArray) {
    if (value.is<unsigned long>()) {
      if (index < MAX_BUFFER_COLORS) {  // Prevent buffer overflow
        targetBuffer[index++] = value.as<unsigned long>();
        frameCount++;
        loadedCount++;
      } else {
        Serial.println("[ScriptMode] WARNING: Buffer overflow prevented - data truncated!");
        break;
      }
    } else {
      Serial.print("[ScriptMode] Warning: Skipping non-numeric value at index ");
      Serial.println(index);
    }
  }

  frameCount = frameCount / NUM_LEDS;  // Convert to frame count
  Serial.print("[ScriptMode] Loaded ");
  Serial.print(loadedCount);
  Serial.print(" color values = ");
  Serial.print(frameCount);
  Serial.println(" frames");
}

// Display a frame from numeric buffer
void displayFormatFrame(int frameIndex) {
  // Bounds check to prevent reading garbage memory
  if (frameIndex < 0 || frameIndex >= formatFrameCount) {
    Serial.print("[ScriptMode] ERROR: Invalid frame index ");
    Serial.print(frameIndex);
    Serial.print(", max is ");
    Serial.println(formatFrameCount - 1);
    return;
  }

  int startIndex = frameIndex * NUM_LEDS;
  for (int i = 0; i < NUM_LEDS; i++) {
    unsigned long color = formatFrames[startIndex + i];
    leds[i] = numberToCRGB(color);
  }
  FastLED.show();
}

// Request a specific buffer by index from the API
bool requestBufferByIndex(int bufferIndex) {
  unsigned long fetchStartTime = millis();

  Serial.println("====================================");
  Serial.print("[ScriptMode] 🚀 BUFFER FETCH START - Buffer index ");
  Serial.print(bufferIndex);
  Serial.print(" at ");
  Serial.print(fetchStartTime);
  Serial.println("ms");

  // Validate buffer index before making request
  unsigned long validationStart = millis();
  int currentTotalBuffers = 0;
  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    currentTotalBuffers = totalBuffers;
    xSemaphoreGive(stateMutex);
  }
  unsigned long validationTime = millis() - validationStart;

  if (bufferIndex < 0 || bufferIndex >= currentTotalBuffers) {
    Serial.print("[ScriptMode] ERROR: Buffer index ");
    Serial.print(bufferIndex);
    Serial.print(" out of range (0-");
    Serial.print(currentTotalBuffers - 1);
    Serial.println("). Skipping request.");

    if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
      bufferFetchPending = false;
      xSemaphoreGive(stateMutex);
    }
    return false;
  }

  Serial.print("[ScriptMode] ✓ Validation: ");
  Serial.print(validationTime);
  Serial.print("ms (buffer ");
  Serial.print(bufferIndex);
  Serial.print("/");
  Serial.print(currentTotalBuffers);
  Serial.println(")");

  // Initialize persistent client on first use
  unsigned long initStart = millis();
  if (!persistentBufferClientInitialized) {
    Serial.println("[ScriptMode] 🔧 Initializing persistent HTTP client...");
    persistentBufferClient.setInsecure();
    persistentBufferClient.setHandshakeTimeout(TLS_HANDSHAKE_TIMEOUT_SEC);
    persistentBufferClientInitialized = true;
    unsigned long initTime = millis() - initStart;
    Serial.print("[ScriptMode] ✓ Client initialized in ");
    Serial.print(initTime);
    Serial.println("ms");
  } else {
    Serial.println("[ScriptMode] ♻️  Reusing existing HTTP connection");
  }

  String url = String(serverHost) + bufferPath + "?index=" + String(bufferIndex);
  Serial.print("[ScriptMode] 🌐 URL: ");
  Serial.println(url);

  // Begin connection
  unsigned long beginStart = millis();
  persistentBufferHttp.begin(persistentBufferClient, url);
  persistentBufferHttp.addHeader("Connection", "keep-alive");
  persistentBufferHttp.setReuse(true);  // Enable connection reuse
  unsigned long beginTime = millis() - beginStart;
  Serial.print("[ScriptMode] ✓ http.begin(): ");
  Serial.print(beginTime);
  Serial.println("ms");

  // Send GET request
  Serial.println("[ScriptMode] 📤 Sending GET request...");
  unsigned long requestStart = millis();
  int httpCode = persistentBufferHttp.GET();
  unsigned long requestTime = millis() - requestStart;
  unsigned long totalTime = millis() - fetchStartTime;

  Serial.println("------------------------------------");
  Serial.print("[ScriptMode] 📥 HTTP Response: ");
  Serial.println(httpCode);
  Serial.print("[ScriptMode] ⏱️  Request time: ");
  Serial.print(requestTime);
  Serial.println("ms");
  Serial.print("[ScriptMode] ⏱️  Total time so far: ");
  Serial.print(totalTime);
  Serial.println("ms");

  if (httpCode > 0 && httpCode == HTTP_CODE_OK) {
    // Read payload
    Serial.println("[ScriptMode] 📖 Reading response payload...");
    unsigned long payloadStart = millis();
    String payload = persistentBufferHttp.getString();
    unsigned long payloadTime = millis() - payloadStart;

    Serial.print("[ScriptMode] ✓ Payload read: ");
    Serial.print(payload.length());
    Serial.print(" bytes in ");
    Serial.print(payloadTime);
    Serial.println("ms");

    // Parse JSON
    Serial.println("[ScriptMode] 🔍 Parsing JSON...");
    unsigned long parseStart = millis();
    DynamicJsonDocument doc(JSON_DOC_SIZE_BUFFER);
    DeserializationError error = deserializeJson(doc, payload);
    unsigned long parseTime = millis() - parseStart;

    Serial.print("[ScriptMode] ✓ JSON parsed in ");
    Serial.print(parseTime);
    Serial.println("ms");

    if (!error) {
      int receivedIndex = doc["buffer_index"] | -1;
      int receivedNextIndex = doc["next_buffer_index"] | 0;
      String format = doc["format"] | "array";  // Check format type

      Serial.print("[ScriptMode] 📦 Buffer ");
      Serial.print(receivedIndex);
      Serial.print(", Next: ");
      Serial.print(receivedNextIndex);
      Serial.print(", Format: ");
      Serial.println(format);

      // Update next buffer index from server
      if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
        nextBufferIndex = receivedNextIndex;
        Serial.print("[ScriptMode] Server says next buffer is ");
        Serial.println(nextBufferIndex);
        xSemaphoreGive(stateMutex);
      }

      // Load the buffer into next buffer slot using appropriate parser
      Serial.println("[ScriptMode] 💾 Loading buffer data...");
      unsigned long loadStart = millis();

      if (format == "hex") {
        // New optimized hex string format
        String hexBuffer = doc["buffer"] | "";
        loadFormatBufferFromHex(hexBuffer, formatNextFrames, formatNextFrameCount);
      } else {
        // Legacy JSON array format
        JsonArray buffer = doc["buffer"];
        loadFormatBufferFromArray(buffer, formatNextFrames, formatNextFrameCount);
      }

      unsigned long loadTime = millis() - loadStart;
      Serial.print("[ScriptMode] ✓ Buffer loaded in ");
      Serial.print(loadTime);
      Serial.println("ms");

      if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
        formatNextBufferLoaded = (formatNextFrameCount > 0);
        bufferFetchPending = false;  // Fetch complete
        xSemaphoreGive(stateMutex);
      }

      unsigned long finalTotalTime = millis() - fetchStartTime;
      Serial.println("====================================");
      Serial.print("[ScriptMode] ✅ FETCH COMPLETE - Total time: ");
      Serial.print(finalTotalTime);
      Serial.println("ms");
      Serial.print("[ScriptMode] 📊 Breakdown:");
      Serial.print(" Request=");
      Serial.print(requestTime);
      Serial.print("ms, Payload=");
      Serial.print(payloadTime);
      Serial.print("ms, Parse=");
      Serial.print(parseTime);
      Serial.print("ms, Load=");
      Serial.print(loadTime);
      Serial.println("ms");
      Serial.println("====================================\n");

      // Don't call http.end() to keep connection alive for reuse
      return formatNextFrameCount > 0;
    } else {
      Serial.println("====================================");
      Serial.print("[ScriptMode] ❌ ERROR: JSON parsing failed: ");
      Serial.println(error.c_str());
      Serial.print("[ScriptMode] Payload size: ");
      Serial.print(payload.length());
      Serial.println(" bytes");
      Serial.print("[ScriptMode] Payload preview (first 200 chars): ");
      Serial.println(payload.substring(0, 200));
      Serial.println("====================================\n");
    }
  } else if (httpCode > 0) {
    // Got a non-200 HTTP response - parse the error message
    Serial.println("====================================");
    Serial.print("[ScriptMode] ❌ ERROR: HTTP ");
    Serial.print(httpCode);
    Serial.print(" - ");
    Serial.println(persistentBufferHttp.errorToString(httpCode));

    unsigned long errorReadStart = millis();
    String errorPayload = persistentBufferHttp.getString();
    unsigned long errorReadTime = millis() - errorReadStart;

    Serial.print("[ScriptMode] Error response (");
    Serial.print(errorPayload.length());
    Serial.print(" bytes, read in ");
    Serial.print(errorReadTime);
    Serial.println("ms):");
    Serial.println(errorPayload);

    // Try to parse JSON error message
    DynamicJsonDocument errorDoc(JSON_DOC_SIZE_ERROR);
    DeserializationError error = deserializeJson(errorDoc, errorPayload);
    if (!error) {
      if (errorDoc.containsKey("error")) {
        Serial.print("[ScriptMode] ❌ API Error: ");
        Serial.println(errorDoc["error"].as<String>());
      }
      if (errorDoc.containsKey("message")) {
        Serial.print("[ScriptMode] 💡 Details: ");
        Serial.println(errorDoc["message"].as<String>());
      }
      if (errorDoc.containsKey("currentMode")) {
        Serial.print("[ScriptMode] Current mode: ");
        Serial.println(errorDoc["currentMode"].as<String>());
      }
    }

    unsigned long errorTotalTime = millis() - fetchStartTime;
    Serial.print("[ScriptMode] ⏱️  Total error handling time: ");
    Serial.print(errorTotalTime);
    Serial.println("ms");
    Serial.println("====================================\n");
  } else {
    // Network error (no response)
    Serial.println("====================================");
    Serial.print("[ScriptMode] ❌ ERROR: Network error. Code: ");
    Serial.print(httpCode);
    Serial.print(", Error: ");
    Serial.println(persistentBufferHttp.errorToString(httpCode));

    unsigned long errorTotalTime = millis() - fetchStartTime;
    Serial.print("[ScriptMode] ⏱️  Time until error: ");
    Serial.print(errorTotalTime);
    Serial.println("ms");

    Serial.println("[ScriptMode] 🔄 Resetting connection for fresh reconnect");
    // On error, end connection to allow fresh reconnect
    persistentBufferHttp.end();
    persistentBufferClientInitialized = false;
    Serial.println("====================================\n");
  }

  // Don't call http.end() on success to keep connection alive

  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    bufferFetchPending = false;  // Fetch failed
    xSemaphoreGive(stateMutex);
  }

  return false;
}

// Setup script mode (server controls buffer sequencing)
void setupScriptMode(int framerate) {
  bool needsSetup = false;

  // Take mutex to protect shared state
  if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
    bool modeChanged = (currentMode != "script");
    needsSetup = modeChanged || !formatBufferLoaded;

    if (!needsSetup) {
      Serial.println("[ScriptMode] Already set up, skipping");
      xSemaphoreGive(stateMutex);
      return;
    }

    Serial.println("[ScriptMode] Setting up script mode...");
    Serial.print("[ScriptMode] Framerate: ");
    Serial.println(framerate);

    currentMode = "script";
    currentBufferIndex = 0;
    nextBufferIndex = 1;  // Server will tell us the actual next index
    bufferToFetch = -1;
    bufferFetchPending = false;
    formatFramerate = framerate;
    formatFrameDelay = (1000 + formatFramerate / 2) / formatFramerate;
    xSemaphoreGive(stateMutex);
  }

  // Request buffer 0 to start playing
  Serial.println("[ScriptMode] Requesting initial buffer (index 0)...");
  if (requestBufferByIndex(0)) {
    // Copy next buffer to current buffer since requestBufferByIndex loads into formatNextFrames
    if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
      if (formatNextBufferLoaded) {
        copyBuffer(formatFrames, formatNextFrames, formatNextFrameCount);
        formatFrameCount = formatNextFrameCount;
        formatNextFrameCount = 0;
        formatBufferLoaded = true;
        formatNextBufferLoaded = false;
        currentFormatFrameIndex = 0;
        lastFormatFrameUpdate = millis();

        Serial.print("[ScriptMode] Initial buffer loaded: ");
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
    Serial.println("[ScriptMode] WARNING: Failed to load initial buffer!");
  }
}

// Loop script mode (called every loop iteration - server controls buffer sequencing)
void loopScriptMode() {
  // Take mutex briefly to read/update state
  if (xSemaphoreTake(stateMutex, MUTEX_TIMEOUT_MS / portTICK_PERIOD_MS) == pdTRUE) {
    if (!formatBufferLoaded || formatFrameCount == 0) {
      if (!formatBufferLoaded) {
        Serial.println("[ScriptMode] No buffer loaded, waiting...");
      }
      xSemaphoreGive(stateMutex);
      return;
    }

    // Request next buffer fetch from background task (non-blocking)
    // Trigger immediately after buffer starts (frame 0+) to give maximum time for HTTP
    // Server controls which buffer comes next via next_buffer_index
    if (!formatNextBufferLoaded && !bufferFetchPending) {
      bufferToFetch = nextBufferIndex;
      bufferFetchPending = true;

      Serial.print("[ScriptMode] Requesting background fetch of buffer index ");
      Serial.print(nextBufferIndex);
      Serial.print(" (current buffer: ");
      Serial.print(currentBufferIndex);
      Serial.print(", frame: ");
      Serial.print(currentFormatFrameIndex);
      Serial.println(")");
    }

    unsigned long currentTime = millis();
    unsigned long timeSinceLastUpdate = currentTime - lastFormatFrameUpdate;

    if (timeSinceLastUpdate >= formatFrameDelay) {
      Serial.print("[ScriptMode] Displaying frame ");
      Serial.print(currentFormatFrameIndex);
      Serial.print(" of ");
      Serial.print(formatFrameCount);
      Serial.print(" (buffer ");
      Serial.print(currentBufferIndex);
      Serial.print(", next: ");
      Serial.print(nextBufferIndex);
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
        Serial.println("[ScriptMode] Buffer complete!");

        unsigned long switchTime = millis();  // Capture time for consistent timing

        if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
          // Buffer complete, switch to next buffer immediately
          if (formatNextBufferLoaded) {
            Serial.print("[ScriptMode] Switching to next buffer (");
            Serial.print(formatNextFrameCount);
            Serial.println(" frames)");

            // Copy next buffer to current buffer
            copyBuffer(formatFrames, formatNextFrames, formatNextFrameCount);
            formatFrameCount = formatNextFrameCount;
            formatNextFrameCount = 0;
            formatBufferLoaded = true;
            formatNextBufferLoaded = false;
            bufferFetchPending = false;  // Ready for next fetch request

            // Update current buffer index (server told us what's next)
            currentBufferIndex = nextBufferIndex;

            Serial.print("[ScriptMode] Now playing buffer index ");
            Serial.println(currentBufferIndex);
          } else {
            Serial.println("[ScriptMode] No next buffer available, waiting for fetch to complete...");
            // Don't increment buffer index - we need to wait for the fetch to complete
            // currentBufferIndex stays the same so we'll loop the current buffer
            // DON'T clear bufferFetchPending - the background task is still fetching!
          }

          // Reset timing and frame index
          currentFormatFrameIndex = 0;
          lastFormatFrameUpdate = switchTime;
          xSemaphoreGive(stateMutex);
        }

        // Display first frame of new buffer immediately (outside mutex)
        displayFormatFrame(0);

        // Update state to start from frame 1 on next iteration
        // This will trigger the next buffer fetch immediately (at frame 1)
        if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
          currentFormatFrameIndex = 1;  // Next frame will be 1 (will trigger prefetch)
          lastFormatFrameUpdate = millis();  // Reset timing for proper framerate
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

// Background task to fetch buffers for custom mode (non-blocking)
void bufferFetchTask(void *parameter) {
  Serial.println("[Buffer Fetch Task] Background buffer fetch task started");

  while (true) {
    // Check if there's a buffer to fetch
    int indexToFetch = -1;
    bool shouldFetch = false;

    if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
      if (bufferFetchPending && bufferToFetch >= 0) {
        indexToFetch = bufferToFetch;
        shouldFetch = true;
        // Don't clear bufferToFetch yet - will be cleared by requestBufferByIndex
      }
      xSemaphoreGive(stateMutex);
    }

    // Fetch the buffer if needed (outside of mutex)
    if (shouldFetch && WiFi.status() == WL_CONNECTED) {
      Serial.print("[Buffer Fetch Task] Fetching buffer index ");
      Serial.println(indexToFetch);
      requestBufferByIndex(indexToFetch);

      // Clear the request after fetch completes (success or failure)
      if (xSemaphoreTake(stateMutex, portMAX_DELAY) == pdTRUE) {
        bufferToFetch = -1;
        xSemaphoreGive(stateMutex);
      }
    }

    // Check frequently for new fetch requests
    vTaskDelay(BUFFER_FETCH_INTERVAL_MS / portTICK_PERIOD_MS);  // Reduced delay for faster response
  }
}

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
    vTaskDelay(API_CHECK_INTERVAL_MS / portTICK_PERIOD_MS);
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

    DynamicJsonDocument doc(JSON_DOC_SIZE_API);
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
      else if (newMode == "script") {
        int newFramerate = doc["framerate"] | 60;
        setupScriptMode(newFramerate);
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
  FastLED.setBrightness(LED_BRIGHTNESS);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  Serial.println("[Setup] FastLED initialized");
  Serial.print("[Setup] LED Pin: ");
  Serial.println(LED_PIN);
  Serial.print("[Setup] Number of LEDs: ");
  Serial.println(NUM_LEDS);
  Serial.print("[Setup] Brightness: ");
  Serial.println(LED_BRIGHTNESS);

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

  // Create background task for buffer fetching (non-blocking)
  xTaskCreate(
    bufferFetchTask,   // Task function
    "Buffer Fetch",    // Task name
    8192,             // Stack size (bytes)
    NULL,              // Parameters
    1,                 // Priority (1 = low, same as API task)
    NULL               // Task handle
  );
  Serial.println("[Setup] Background buffer fetch task created");

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
  if (xSemaphoreTake(stateMutex, MUTEX_TIMEOUT_MS / portTICK_PERIOD_MS) == pdTRUE) {
    modeToUse = currentMode;
    xSemaphoreGive(stateMutex);
  }

  if (modeToUse == "simple") {
    loopSimpleMode();
  } else if (modeToUse == "loop") {
    loopLoopMode();
  } else if (modeToUse == "script") {
    loopScriptMode();
  }

  // Small delay to prevent watchdog issues
  delay(10);
}
