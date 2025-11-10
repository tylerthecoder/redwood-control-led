#include <WiFi.h>  // For ESP32 - use #include <ESP8266WiFi.h> for ESP8266
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// WiFi credentials
const char* ssid = "FBI Van";
const char* password = "Tyler123";

// Server configuration
const char* serverHost = "https://control-led.tylertracy.com/";
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
unsigned long formatFrames[36000];  // Current buffer: 600 frames * 60 LEDs = 36000 numbers
unsigned long formatNextFrames[36000];  // Next buffer (loaded in background)
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
  if (on) {
    CRGB rgbColor = hexToCRGB(color);
    fill_solid(leds, NUM_LEDS, rgbColor);
  } else {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
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
    return;
  }

  unsigned long currentTime = millis();
  if (currentTime - lastFormatFrameUpdate >= formatFrameDelay) {
    lastFormatFrameUpdate = currentTime;

    displayFormatFrame(currentFormatFrameIndex);

    currentFormatFrameIndex++;

    // Check if buffer is complete
    int framesPerBuffer = formatFrameCount;
    if (currentFormatFrameIndex >= framesPerBuffer) {
      // Buffer complete, switch to next buffer
      if (formatNextBufferLoaded) {
        // Copy next buffer to current buffer
        for (int i = 0; i < formatNextFrameCount * NUM_LEDS; i++) {
          formatFrames[i] = formatNextFrames[i];
        }

        formatFrameCount = formatNextFrameCount;
        formatNextFrameCount = 0;
        formatBufferLoaded = true;
        formatNextBufferLoaded = false;
        currentFormatFrameIndex = 0;

        // Notify server
        notifyBufferComplete();
      } else {
        // No next buffer, loop current buffer
        currentFormatFrameIndex = 0;
      }
    }
  }
}

// Notify server that buffer is complete
void notifyBufferComplete() {
  WiFiClient client;
  HTTPClient http;

  String url = String(serverHost) + completePath;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String json = "{\"action\":\"completeBuffer\"}";
  int httpCode = http.POST(json);

  if (httpCode > 0) {
    Serial.print("Buffer complete notification sent: ");
    Serial.println(httpCode);
  } else {
    Serial.print("Failed to notify buffer complete: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// Load format buffer from JSON array
void loadFormatBuffer(JsonArray bufferArray, unsigned long* targetBuffer, int& frameCount) {
  frameCount = 0;
  int index = 0;

  for (JsonVariant value : bufferArray) {
    if (value.is<unsigned long>()) {
      targetBuffer[index++] = value.as<unsigned long>();
      frameCount++;
    }
  }

  frameCount = frameCount / NUM_LEDS;  // Convert to frame count
}

// Check and update LED state from API
void checkLedState() {
  HTTPClient http;
  String url = String(serverHost) + apiPath;

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode > 0 && httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    DynamicJsonDocument doc(32768);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      String newMode = doc["mode"] | "simple";
      bool modeChanged = (newMode != currentMode);

      if (newMode == "simple") {
        bool newOn = doc["on"] | false;
        String newColor = doc["color"] | "#0000FF";

        if (modeChanged || newOn != simpleOn || newColor != simpleColor) {
          currentMode = "simple";
          simpleOn = newOn;
          simpleColor = newColor;
          handleSimpleMode(simpleOn, simpleColor);
          Serial.print("Simple mode - ");
          Serial.print(simpleOn ? "ON" : "OFF");
          Serial.print(" - Color: ");
          Serial.println(simpleColor);
        }
      }
      else if (newMode == "loop") {
        JsonArray colors = doc["colors"];
        unsigned long newDelay = doc["delay"] | 1000;

        bool loopChanged = (colors.size() != loopColorCount);
        if (!loopChanged) {
          for (int i = 0; i < colors.size() && i < 20; i++) {
            String color = colors[i] | "#FFFFFF";
            if (color != loopColors[i]) {
              loopChanged = true;
              break;
            }
          }
        }

        if (modeChanged || loopChanged || newDelay != loopDelay) {
          currentMode = "loop";
          loopDelay = newDelay;
          loopColorCount = min((int)colors.size(), 20);

          for (int i = 0; i < loopColorCount; i++) {
            loopColors[i] = colors[i] | "#FFFFFF";
          }

          if (modeChanged || loopChanged) {
            currentLoopIndex = 0;
            lastLoopUpdate = millis();
            CRGB color = hexToCRGB(loopColors[0]);
            fill_solid(leds, NUM_LEDS, color);
            FastLED.show();
          }

          Serial.print("Loop mode - ");
          Serial.print(loopColorCount);
          Serial.print(" colors, delay: ");
          Serial.print(loopDelay);
          Serial.println("ms");
        }
      }
      else if (newMode == "format") {
        JsonArray currentBuffer = doc["currentBuffer"];
        JsonArray nextBuffer = doc["nextBuffer"];
        int newFramerate = doc["framerate"] | 60;

        if (modeChanged || !formatBufferLoaded) {
          // Load current buffer
          loadFormatBuffer(currentBuffer, formatFrames, formatFrameCount);
          formatBufferLoaded = (formatFrameCount > 0);
          formatFramerate = newFramerate;
          formatFrameDelay = (1000 + formatFramerate / 2) / formatFramerate;
          currentFormatFrameIndex = 0;
          lastFormatFrameUpdate = millis();

          if (formatBufferLoaded) {
            displayFormatFrame(0);
          }

          Serial.print("Format mode - Buffer loaded: ");
          Serial.print(formatFrameCount);
          Serial.print(" frames @ ");
          Serial.print(formatFramerate);
          Serial.println(" fps");
        }

        // Load next buffer in background if available
        if (nextBuffer.size() > 0 && !formatNextBufferLoaded) {
          loadFormatBuffer(nextBuffer, formatNextFrames, formatNextFrameCount);
          formatNextBufferLoaded = (formatNextFrameCount > 0);
          Serial.println("Next buffer loaded in background");
        }
      }
    } else {
      Serial.print("JSON parsing failed: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("HTTP GET failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(80);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  checkLedState();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("Reconnected!");
  }

  // Handle current mode
  if (currentMode == "loop") {
    handleLoopMode();
  } else if (currentMode == "format") {
    handleFormatMode();
  }

  // Check API periodically
  unsigned long currentTime = millis();
  if (currentTime - lastCheckTime >= checkInterval) {
    lastCheckTime = currentTime;
    checkLedState();
  }

  delay(50);
}
