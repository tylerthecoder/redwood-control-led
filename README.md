# LED Control System

A full-stack LED control system with a Next.js web interface and ESP32 Arduino firmware for controlling WS2812B LED strips with three different modes: Simple, Loop, and Custom animations.

## System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌────────────────┐
│   Web Client    │  HTTPS  │   Next.js API    │  HTTPS  │  ESP32 (WiFi)  │
│   (Browser)     │────────▶│   (Server)       │◀────────│   + FastLED    │
└─────────────────┘         └──────────────────┘         └────────────────┘
                                    │                              │
                                    │ State Storage                │ 60 WS2812B
                                    ▼                              │ LEDs
                            ┌──────────────┐                       ▼
                            │   ledState   │               ┌──────────────┐
                            │   (in-memory)│               │  LED Strip   │
                            └──────────────┘               └──────────────┘
```

## Project Structure

```
control-led/
├── app/                          # Next.js application
│   ├── api/
│   │   └── control/
│   │       ├── route.ts          # Main control endpoint (GET/POST)
│   │       ├── state.ts          # Shared LED state management
│   │       └── buffer/
│   │           └── route.ts      # Buffer endpoint for custom mode
│   ├── components/               # React components
│   ├── simple/                   # Simple mode page
│   ├── loop/                     # Loop mode page
│   ├── custom/                   # Custom mode page
│   └── examples.ts               # Animation generators
└── arduino/
    └── control_led.ino           # ESP32 firmware
```

## Control Flow Overview

### 1. Web Client → API Server

The web client interacts with the API through HTTP requests:

```
POST /api/control
- Updates LED state (mode, colors, frames, etc.)
- Validates input
- Processes frames into buffers (for custom mode)
- Returns updated state

GET /api/control
- Returns current LED state
- For custom mode, returns metadata only (no buffer data)

GET /api/control/buffer?index=N
- Returns a specific buffer for custom mode
- Used by Arduino to fetch animation buffers
```

### 2. API Server State Management

The server maintains LED state in memory using a type-safe state system:

**State Types:**
- **SimpleMode**: Single color on/off control
- **LoopMode**: Cycles through array of colors
- **CustomMode**: Frame-by-frame animations

**State File** (`app/api/control/state.ts`):
```typescript
type LedState = SimpleMode | LoopMode | CustomMode;
```

The state is updated atomically via `updateState()` and read directly via `ledState`.

### 3. Arduino → API Server Polling

The Arduino firmware polls the API to check for state changes:

**Background Task Flow:**
```
┌─────────────────────────────────────────────────────┐
│  FreeRTOS Task: apiTask (runs every 1 second)      │
│                                                      │
│  1. GET /api/control                                │
│  2. Parse JSON response                             │
│  3. Call setup function based on mode:              │
│     • setupSimpleMode(on, color)                    │
│     • setupLoopMode(colors[], delay)                │
│     • setupCustomMode(totalBuffers, framerate)      │
└─────────────────────────────────────────────────────┘
```

**Main Loop Flow:**
```
┌─────────────────────────────────────────────────────┐
│  loop() (runs continuously)                         │
│                                                      │
│  1. Check WiFi connection                           │
│  2. Call loop function for current mode:            │
│     • loopSimpleMode() - no-op (set once)           │
│     • loopLoopMode() - change color on timer        │
│     • loopCustomMode() - display frames + prefetch  │
└─────────────────────────────────────────────────────┘
```

The system uses FreeRTOS with a mutex to protect shared state between the background API task and the main loop.

## Operation Modes

### Simple Mode

**Purpose**: Static color control (on/off with a single color)

**Web → API:**
```javascript
POST /api/control
{
  "mode": "simple",
  "on": true,
  "color": "#FF0000"
}
```

**API → Arduino:**
```javascript
GET /api/control →
{
  "mode": "simple",
  "on": true,
  "color": "#FF0000"
}
```

**Arduino Behavior:**
1. `setupSimpleMode()` sets all 60 LEDs to the specified color (or off)
2. `loopSimpleMode()` does nothing (LEDs remain in set state)

### Loop Mode

**Purpose**: Cycle through multiple colors with a configurable delay

**Web → API:**
```javascript
POST /api/control
{
  "mode": "loop",
  "colors": ["#FF0000", "#00FF00", "#0000FF"],
  "delay": 1000  // milliseconds
}
```

**API → Arduino:**
```javascript
GET /api/control →
{
  "mode": "loop",
  "colors": ["#FF0000", "#00FF00", "#0000FF"],
  "delay": 1000
}
```

**Arduino Behavior:**
1. `setupLoopMode()` stores colors array and displays first color
2. `loopLoopMode()` changes to next color every `delay` milliseconds
3. Loops continuously through color array

### Custom Mode (Frame-by-Frame Animation)

**Purpose**: Play complex animations with precise control over each LED at each frame

This is the most complex mode, involving buffer management and prefetching for seamless playback.

#### Step 1: Upload Animation

**Web → API:**
```javascript
POST /api/control
{
  "mode": "custom",
  "framerate": 60,
  "frames": [
    "#FF0000,#FF0000,...,#FF0000",  // Frame 0: 60 hex colors
    "#00FF00,#00FF00,...,#00FF00",  // Frame 1: 60 hex colors
    // ... more frames
  ]
}
```

**API Processing:**
1. Validates each frame has exactly 60 hex colors
2. Converts hex strings to 24-bit RGB numbers for efficiency
3. Splits frames into 0.5-second buffers:
   - At 60fps: 30 frames per buffer = 1800 numbers (30 frames × 60 LEDs)
   - At 30fps: 15 frames per buffer = 900 numbers
4. Stores buffers in `ledState.buffers` array

**Why Buffers?**
- Reduces JSON size per request (~16KB vs ~32KB for full animation)
- Enables prefetching for smooth playback
- Reduces memory usage on Arduino

#### Step 2: Arduino Setup

**Arduino → API:**
```javascript
GET /api/control →
{
  "mode": "custom",
  "totalBuffers": 20,    // e.g., 10 seconds at 60fps = 600 frames = 20 buffers
  "framerate": 60
}
```

**Arduino Initialization:**
1. `setupCustomMode()` is called with totalBuffers and framerate
2. Calculates frame delay: `frameDelay = 1000 / framerate` (e.g., ~16ms for 60fps)
3. Requests buffer 0: `GET /api/control/buffer?index=0`
4. Loads buffer into `formatFrames[]` array
5. Displays first frame immediately

#### Step 3: Playback with Prefetching

**The Buffer Double-Buffering System:**

```
┌──────────────────────────────────────────────────────┐
│                 Arduino Memory                        │
│                                                        │
│  formatFrames[1800]      ← Currently playing buffer  │
│  formatNextFrames[1800]  ← Prefetched next buffer    │
└──────────────────────────────────────────────────────┘
```

**Playback Loop (loopCustomMode):**

```
Every frame (e.g., every 16ms at 60fps):

1. ┌─ Prefetch Check ────────────────────────────────┐
   │ • If next buffer not loaded and not requested:  │
   │   - Calculate next index: (current + 1) % total │
   │   - Request: GET /api/control/buffer?index=N    │
   │   - Load into formatNextFrames[]                │
   └────────────────────────────────────────────────-┘

2. ┌─ Display Frame ─────────────────────────────────┐
   │ • Read 60 colors from formatFrames[]            │
   │ • Convert to CRGB and display on LEDs           │
   │ • Increment frame index                         │
   └────────────────────────────────────────────────-┘

3. ┌─ Buffer Switch (when buffer complete) ─────────┐
   │ • Copy formatNextFrames → formatFrames          │
   │ • Reset frame index to 0                        │
   │ • Increment buffer index (wraps to 0 at end)    │
   │ • Display first 2 frames immediately            │
   └────────────────────────────────────────────────-┘
```

**Timeline Example (3 buffers, 0.5s each):**

```
Time    Buffer 0           Buffer 1           Buffer 2
─────   ───────────────    ───────────────    ───────────────
0.0s    ┌─ PLAYING ─┐     REQUEST →
        │ Frame 0   │     ← LOADING
0.1s    │ Frame 6   │     [prefetching]
0.2s    │ Frame 12  │     [prefetching]
0.4s    │ Frame 24  │     ✓ LOADED
0.5s    COMPLETE ───┘

0.5s                      ┌─ PLAYING ─┐      REQUEST →
                          │ Frame 0   │      ← LOADING
0.6s                      │ Frame 6   │      [prefetching]
0.8s                      │ Frame 16  │      ✓ LOADED
1.0s                      COMPLETE ───┘

1.0s                                         ┌─ PLAYING ─┐
                                             │ Frame 0   │
1.2s                                         │ Frame 12  │
1.5s                                         COMPLETE ───┘
                                             (loops to buffer 0)
```

**Key Design Decisions:**

1. **No Wait Between Buffers**: Next buffer is prefetched while current buffer plays
2. **Immediate Frame Display on Switch**: Frames 0 and 1 of new buffer display immediately (workaround for timing)
3. **Wrapping Playback**: Animation loops seamlessly (buffer index wraps with modulo)

## Data Format Specifications

### Hex Color Format
- Standard 6-digit hex: `#RRGGBB`
- Example: `#FF0000` (red), `#00FF00` (green), `#0000FF` (blue)

### Frame Format (Custom Mode)
- 60 comma-separated hex colors per frame
- Example: `"#FF0000,#FF0000,#FF0000,...,#FF0000"` (60 colors total)

### Buffer Format (API Response)
- Array of 24-bit RGB numbers
- Size: `framesPerBuffer × 60 LEDs`
- Example buffer (30 frames at 60fps):
  ```javascript
  {
    "buffer": [16711680, 16711680, ..., 16711680],  // 1800 numbers
    "bufferIndex": 0,
    "totalBuffers": 20,
    "framerate": 60
  }
  ```

## Timing & Performance

### Frame Timing (Custom Mode)

| Framerate | Frame Delay | Frames/Buffer | Buffer Duration | Buffer Size |
|-----------|-------------|---------------|-----------------|-------------|
| 60 fps    | ~16.67 ms   | 30 frames     | 0.5 seconds     | ~16 KB      |
| 30 fps    | ~33.33 ms   | 15 frames     | 0.5 seconds     | ~8 KB       |

### API Polling
- Background task polls API every **1 second**
- State changes detected within 1 second
- Does not block main loop

### Buffer Prefetching
- Prefetch triggers when next buffer not loaded
- HTTP request blocks main loop temporarily
- Request typically completes within 100-200ms on good WiFi

## Concurrency & Thread Safety

### Arduino (FreeRTOS)
```
┌────────────────────────────────────────────────────┐
│  Task 1: apiTask (Priority 1)                     │
│  - Polls API every 1 second                        │
│  - Updates state variables                         │
│                                                     │
│  Task 2: loop() (Priority 1)                       │
│  - Displays LED frames                             │
│  - Reads state variables                           │
│                                                     │
│  Mutex: stateMutex                                 │
│  - Protects shared variables                       │
│  - Acquired with timeout                           │
└────────────────────────────────────────────────────┘
```

**Protected State Variables:**
- `currentMode`
- `simpleOn`, `simpleColor`
- `loopColors[]`, `loopDelay`, `currentLoopIndex`
- `formatFrameCount`, `formatFramerate`, `currentBufferIndex`, `totalBuffers`
- Buffer flags: `formatBufferLoaded`, `formatNextBufferLoaded`, `formatNextBufferRequested`

### Next.js API (Node.js)
- Single-threaded event loop (no explicit locking needed)
- State mutations are atomic within request handlers
- Concurrent requests handled sequentially by Node.js

## Error Handling

### API Validation
- Frame count validation (must have 60 colors)
- Hex color format validation (must be `#RRGGBB`)
- Buffer index range validation
- Mode-specific validation

### Arduino Resilience
- WiFi reconnection on disconnect
- Continues playing current buffer if next buffer fails to load
- Loops current buffer if API unavailable
- Serial logging for debugging

## Configuration

### Arduino Configuration
```cpp
// WiFi credentials
const char* ssid = "FBI Van";
const char* password = "Tyler123";

// Server
const char* serverHost = "https://control-led.tylertracy.com";

// LED strip
#define LED_PIN 18
#define NUM_LEDS 60
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
```

### API Configuration
```typescript
const BUFFER_DURATION_SECONDS = 0.5;
const NUM_LEDS = 60;
```

## Development Setup

### Next.js Server

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

### Arduino Setup

1. Install Arduino IDE or PlatformIO
2. Install libraries:
   - FastLED
   - ArduinoJson
   - WiFiClientSecure
3. Update WiFi credentials in `control_led.ino`
4. Update server host URL
5. Upload to ESP32

## API Endpoints Reference

### POST /api/control
Update LED state.

**Request Body:**
```typescript
// Simple Mode
{ mode: "simple", on: boolean, color: string }

// Loop Mode
{ mode: "loop", colors: string[], delay: number }

// Custom Mode
{ mode: "custom", framerate: number, frames: string[] }
```

**Response:**
```typescript
{ success: boolean, ...currentState }
```

### GET /api/control
Get current LED state.

**Response (Simple/Loop):**
```typescript
{ mode: "simple"|"loop", ...modeSpecificProps }
```

**Response (Custom):**
```typescript
{ mode: "custom", totalBuffers: number, framerate: number }
```

### GET /api/control/buffer?index=N
Get a specific buffer (custom mode only).

**Query Parameters:**
- `index`: Buffer index (0 to totalBuffers-1)

**Response:**
```typescript
{
  buffer: number[],        // RGB numbers
  bufferIndex: number,
  totalBuffers: number,
  framerate: number
}
```

## Potential Improvements

### Performance Optimizations
1. **Async Buffer Requests**: Move HTTP requests to background task to avoid blocking frame display
2. **Adaptive Prefetching**: Prefetch earlier in buffer playback (e.g., at 50% complete)
3. **Compression**: Use gzip compression for buffer responses

### Features
1. **Brightness Control**: Add global brightness parameter
2. **Pause/Resume**: Add playback control for custom mode
3. **Buffer Caching**: Cache buffers on Arduino SPIFFS/SD card
4. **Real-time Streaming**: WebSocket support for live control

### Monitoring
1. **State Viewer**: Real-time LED state display (already exists in `/components/state-viewer.tsx`)
2. **Performance Metrics**: Track frame timing, dropped frames, API latency
3. **Health Check Endpoint**: Monitor Arduino connectivity

## Troubleshooting

### Animation Stutters
- Check WiFi signal strength (should be > -70 dBm)
- Reduce framerate (60fps → 30fps)
- Increase buffer duration (0.5s → 1.0s)

### Buffer Loading Fails
- Check API server is accessible from Arduino
- Verify HTTPS certificate (using `.setInsecure()` currently)
- Check available memory on ESP32

### LEDs Wrong Color
- Verify `COLOR_ORDER` setting (GRB vs RGB)
- Check LED strip voltage (5V)
- Verify data pin connection (GPIO 18)

## License

MIT License - Feel free to use and modify for your projects.

---

Built with Next.js, TypeScript, ESP32, and FastLED.
