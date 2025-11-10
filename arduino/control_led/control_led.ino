#include <WiFi.h>  // For ESP32 - use #include <ESP8266WiFi.h> for ESP8266
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// WiFi credentials
const char* ssid = "FBI Van";
const char* password = "Tyler123";

// Server configuration
const char* serverHost = "10.0.0.230";  // Change to your computer's IP address running the Next.js server
const int serverPort = 3002;
const char* apiPath = "/api/control";

// FastLED configuration
#define LED_PIN 18        // GPIO pin connected to LED strip
#define NUM_LEDS 60      // Number of LEDs in your strip
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
CRGB leds[NUM_LEDS];

// Mode state
String currentMode = "simple";
bool simpleOn = false;
String simpleColor = "#0000FF";
String loopColors[20];  // Max 20 colors in loop
int loopColorCount = 0;
unsigned long loopDelay = 1000;
unsigned long lastLoopUpdate = 0;
int currentLoopIndex = 0;

// Format mode state
String formatFrames[1000];  // Max 1000 frames
int formatFrameCount = 0;
int formatFramerate = 60;
unsigned long formatFrameDelay = 0;  // Calculated from framerate
unsigned long lastFormatFrameUpdate = 0;
int currentFormatFrameIndex = 0;

// API check timing
unsigned long lastCheckTime = 0;
const unsigned long checkInterval = 1000; // Check every second (1000ms)

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

// Parse a frame string (comma-separated hex colors) and display it
void parseAndDisplayFrame(String frame) {
  // Split by comma
  int startIndex = 0;
  int ledIndex = 0;

  for (int i = 0; i <= frame.length() && ledIndex < NUM_LEDS; i++) {
    if (i == frame.length() || frame.charAt(i) == ',') {
      if (i > startIndex) {
        String colorStr = frame.substring(startIndex, i);
        colorStr.trim();
        CRGB color = hexToCRGB(colorStr);
        leds[ledIndex] = color;
        ledIndex++;
      }
      startIndex = i + 1;
    }
  }

  FastLED.show();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize FastLED
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(50);

  // Set all LEDs to off initially
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  // Connect to WiFi
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

  // Initial check
  checkLedState();
}

void loop() {
  // Check if WiFi is still connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("Reconnected!");
  }

  // Handle loop mode animation
  if (currentMode == "loop" && loopColorCount > 0) {
    unsigned long currentTime = millis();
    if (currentTime - lastLoopUpdate >= loopDelay) {
      lastLoopUpdate = currentTime;
      CRGB color = hexToCRGB(loopColors[currentLoopIndex]);
      fill_solid(leds, NUM_LEDS, color);
      FastLED.show();

      currentLoopIndex = (currentLoopIndex + 1) % loopColorCount;
      Serial.print("Loop color index: ");
      Serial.println(currentLoopIndex);
    }
  }

  // Handle format mode animation
  if (currentMode == "format" && formatFrameCount > 0) {
    unsigned long currentTime = millis();
    if (currentTime - lastFormatFrameUpdate >= formatFrameDelay) {
      lastFormatFrameUpdate = currentTime;

      // Parse and display current frame
      String frame = formatFrames[currentFormatFrameIndex];
      parseAndDisplayFrame(frame);

      currentFormatFrameIndex = (currentFormatFrameIndex + 1) % formatFrameCount;
    }
  }

  // Check API every second
  unsigned long currentTime = millis();
  if (currentTime - lastCheckTime >= checkInterval) {
    lastCheckTime = currentTime;
    checkLedState();
  }

  delay(50); // Small delay to prevent watchdog issues
}

void checkLedState() {
  HTTPClient http;

  // Build URL
  String url = String("http://") + serverHost + ":" + String(serverPort) + apiPath;

  Serial.print("Checking LED state: ");
  Serial.println(url);

  http.begin(url);
  int httpCode = http.GET();

  if (httpCode > 0) {
    Serial.printf("HTTP Response code: %d\n", httpCode);

    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      Serial.println("Response: " + payload);

      // Parse JSON response (larger buffer for format mode with many frames)
      DynamicJsonDocument doc(32768);  // 32KB buffer
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        String newMode = doc["mode"] | "simple";
        bool modeChanged = (newMode != currentMode);

        if (modeChanged || newMode == "simple") {
          // Handle simple mode
          if (newMode == "simple") {
            bool newOn = doc["on"] | false;
            String newColor = doc["color"] | "#0000FF";

            if (modeChanged || newOn != simpleOn || newColor != simpleColor) {
              currentMode = "simple";
              simpleOn = newOn;
              simpleColor = newColor;

              if (simpleOn) {
                CRGB color = hexToCRGB(simpleColor);
                fill_solid(leds, NUM_LEDS, color);
              } else {
                fill_solid(leds, NUM_LEDS, CRGB::Black);
              }
              FastLED.show();

              Serial.print("Simple mode - ");
              Serial.print(simpleOn ? "ON" : "OFF");
              Serial.print(" - Color: ");
              Serial.println(simpleColor);
            }
          }
        }

        if (modeChanged || newMode == "loop") {
          // Handle loop mode
          if (newMode == "loop") {
            JsonArray colors = doc["colors"];
            unsigned long newDelay = doc["delay"] | 1000;

            bool loopChanged = false;

            // Check if colors changed
            if (colors.size() != loopColorCount) {
              loopChanged = true;
            } else {
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

              // Reset loop index when mode changes or colors change
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
        }

        if (modeChanged || newMode == "format") {
          // Handle format mode
          if (newMode == "format") {
            JsonArray frames = doc["frames"];
            int newFramerate = doc["framerate"] | 60;

            bool formatChanged = false;

            // Check if frames changed
            if (frames.size() != formatFrameCount) {
              formatChanged = true;
            } else {
              for (int i = 0; i < frames.size() && i < 1000; i++) {
                String frame = frames[i] | "";
                if (frame != formatFrames[i]) {
                  formatChanged = true;
                  break;
                }
              }
            }

            if (modeChanged || formatChanged || newFramerate != formatFramerate) {
              currentMode = "format";
              formatFramerate = newFramerate;
              // Convert fps to milliseconds per frame (round to nearest)
              formatFrameDelay = (1000 + formatFramerate / 2) / formatFramerate;
              formatFrameCount = min((int)frames.size(), 1000);

              // Store frames
              for (int i = 0; i < formatFrameCount; i++) {
                formatFrames[i] = frames[i] | "";
              }

              // Reset frame index when mode changes or frames change
              if (modeChanged || formatChanged) {
                currentFormatFrameIndex = 0;
                lastFormatFrameUpdate = millis();
                if (formatFrameCount > 0) {
                  parseAndDisplayFrame(formatFrames[0]);
                }
              }

              Serial.print("Format mode - ");
              Serial.print(formatFrameCount);
              Serial.print(" frames, ");
              Serial.print(formatFramerate);
              Serial.println(" fps");
            }
          }
        }
      } else {
        Serial.print("JSON parsing failed: ");
        Serial.println(error.c_str());
      }
    }
  } else {
    Serial.printf("HTTP GET failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
