# Clawdbot Tools Reference

Complete reference for Clawdbot's tool integrations including browser control, Canvas, camera, and automation features.

## Overview

Clawdbot provides agents with access to powerful tools:

| Tool | Description |
|------|-------------|
| Browser | Chrome/Chromium control |
| Canvas | Visual workspace |
| Camera | Device camera access |
| Screen | Screen recording |
| Webhooks | HTTP event receivers |
| Cron | Scheduled tasks |
| Voice | Text-to-speech |
| Files | File system access |

## Browser Control

### Configuration

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "headless": false,
      "executablePath": "/usr/bin/chromium",
      "userDataDir": "~/.clawdbot/browser-data",
      "defaultViewport": {
        "width": 1280,
        "height": 720
      }
    }
  }
}
```

### Capabilities

| Action | Description |
|--------|-------------|
| Navigate | Go to URLs |
| Click | Click elements |
| Type | Enter text |
| Screenshot | Capture page |
| PDF | Save as PDF |
| Execute | Run JavaScript |
| Wait | Wait for elements |

### Usage Examples

```typescript
// Navigate to URL
await browser_navigate({ url: 'https://example.com' });

// Click element
await browser_click({ selector: 'button.submit' });

// Type text
await browser_type({
  selector: 'input[name="search"]',
  text: 'search query'
});

// Take screenshot
const screenshot = await browser_screenshot({
  fullPage: true,
  format: 'png'
});

// Execute JavaScript
const result = await browser_execute({
  script: 'return document.title'
});
```

### Security

- Browser runs in isolated profile
- Extensions disabled by default
- Cookies persist in `userDataDir`
- Network requests logged

## Canvas

Canvas provides a visual workspace for agents to create and manipulate graphics.

### Configuration

```json
{
  "tools": {
    "canvas": {
      "enabled": true,
      "port": 18793,
      "maxWidth": 4096,
      "maxHeight": 4096
    }
  }
}
```

### Capabilities

| Action | Description |
|--------|-------------|
| Create | New canvas |
| Draw | Shapes, lines |
| Text | Add text |
| Image | Add images |
| Export | Save as PNG/SVG |
| Clear | Clear canvas |

### Usage Examples

```typescript
// Create canvas
const canvas = await canvas_create({
  width: 800,
  height: 600,
  background: '#ffffff'
});

// Draw rectangle
await canvas_rect({
  canvasId: canvas.id,
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  fill: '#3498db',
  stroke: '#2980b9'
});

// Add text
await canvas_text({
  canvasId: canvas.id,
  text: 'Hello World',
  x: 150,
  y: 175,
  font: '24px Arial',
  fill: '#ffffff'
});

// Export as PNG
const image = await canvas_export({
  canvasId: canvas.id,
  format: 'png'
});
```

### Node Integration

Canvas is exposed on iOS/Android nodes:

```json
{
  "nodes": {
    "ios": {
      "canvas": true
    },
    "android": {
      "canvas": true
    }
  }
}
```

## Camera

### Configuration

```json
{
  "tools": {
    "camera": {
      "enabled": true,
      "defaultDevice": "default",
      "resolution": {
        "width": 1920,
        "height": 1080
      },
      "format": "jpeg",
      "quality": 90
    }
  }
}
```

### Capabilities

| Action | Description |
|--------|-------------|
| List | List cameras |
| Capture | Take photo |
| Stream | Video stream |
| Settings | Adjust settings |

### Usage Examples

```typescript
// List available cameras
const cameras = await camera_list();

// Capture photo
const photo = await camera_capture({
  deviceId: 'default',
  format: 'jpeg',
  quality: 90
});

// Capture with specific resolution
const hiRes = await camera_capture({
  width: 3840,
  height: 2160
});
```

### Node Integration

Camera access on mobile nodes:

```json
{
  "nodes": {
    "ios": {
      "camera": {
        "enabled": true,
        "permissions": ["camera"]
      }
    }
  }
}
```

## Screen Recording

### Configuration

```json
{
  "tools": {
    "screen": {
      "enabled": true,
      "recording": {
        "enabled": true,
        "maxDuration": 300,
        "format": "mp4",
        "fps": 30,
        "quality": "high"
      },
      "screenshot": {
        "enabled": true,
        "format": "png"
      }
    }
  }
}
```

### Capabilities

| Action | Description |
|--------|-------------|
| Screenshot | Capture screen |
| Record Start | Start recording |
| Record Stop | Stop recording |
| List Displays | Available displays |

### Usage Examples

```typescript
// Take screenshot
const screenshot = await screen_screenshot({
  display: 0,
  format: 'png'
});

// Start recording
const recording = await screen_record_start({
  display: 0,
  fps: 30,
  quality: 'high'
});

// Stop recording
const video = await screen_record_stop({
  recordingId: recording.id
});
```

## Webhooks

### Configuration

```json
{
  "tools": {
    "webhooks": {
      "enabled": true,
      "port": 18796,
      "endpoints": [
        {
          "path": "/webhook/github",
          "secret": "your-webhook-secret",
          "methods": ["POST"]
        },
        {
          "path": "/webhook/stripe",
          "secret": "whsec_...",
          "methods": ["POST"]
        }
      ]
    }
  }
}
```

### Receiving Webhooks

Webhooks are received and can trigger agent actions:

```typescript
// Register webhook handler
api.registerWebhook({
  path: '/webhook/custom',
  handler: async (req, res) => {
    const body = await req.json();

    // Process webhook
    await processEvent(body);

    res.json({ received: true });
  }
});
```

### Security

- Signature verification
- Secret validation
- Rate limiting
- Request logging

## Cron Jobs

### Configuration

```json
{
  "tools": {
    "cron": {
      "enabled": true,
      "jobs": [
        {
          "name": "daily-summary",
          "schedule": "0 9 * * *",
          "action": "summarize-inbox",
          "timezone": "America/New_York"
        },
        {
          "name": "hourly-check",
          "schedule": "0 * * * *",
          "action": "check-status"
        }
      ]
    }
  }
}
```

### Cron Syntax

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sun-Sat)
│ │ │ │ │
* * * * *
```

### Common Schedules

| Schedule | Cron Expression |
|----------|-----------------|
| Every minute | `* * * * *` |
| Every hour | `0 * * * *` |
| Daily at 9 AM | `0 9 * * *` |
| Weekdays at 9 AM | `0 9 * * 1-5` |
| Every Monday | `0 0 * * 1` |
| Monthly | `0 0 1 * *` |

### Job Actions

```typescript
// Register cron action
api.registerCronAction({
  name: 'summarize-inbox',
  handler: async () => {
    const summary = await summarizeInbox();
    await sendNotification(summary);
  }
});
```

## Voice / TTS

### Configuration

```json
{
  "tools": {
    "voice": {
      "enabled": true,
      "provider": "elevenlabs",
      "apiKey": "your-elevenlabs-key",
      "defaultVoice": "rachel",
      "defaultModel": "eleven_monolingual_v1"
    }
  }
}
```

### Providers

| Provider | Features |
|----------|----------|
| ElevenLabs | High-quality voices |
| OpenAI | GPT-4 voices |
| System | OS built-in |

### Usage Examples

```typescript
// Text to speech
const audio = await voice_speak({
  text: 'Hello, how can I help you?',
  voice: 'rachel',
  speed: 1.0
});

// Play audio
await audio_play({ buffer: audio });
```

### Voice Wake

Voice activation on companion apps:

```json
{
  "voice": {
    "wake": {
      "enabled": true,
      "phrase": "Hey Clawd",
      "sensitivity": 0.5
    }
  }
}
```

## File System

### Configuration

```json
{
  "tools": {
    "files": {
      "enabled": true,
      "allowedPaths": [
        "~/.clawdbot/workspace",
        "~/Documents"
      ],
      "deniedPaths": [
        "~/.ssh",
        "~/.gnupg"
      ],
      "maxFileSize": 104857600
    }
  }
}
```

### Capabilities

| Action | Description |
|--------|-------------|
| Read | Read file contents |
| Write | Write file |
| List | List directory |
| Delete | Delete file |
| Move | Move/rename |
| Copy | Copy file |

### Usage Examples

```typescript
// Read file
const content = await file_read({
  path: '~/Documents/notes.txt'
});

// Write file
await file_write({
  path: '~/Documents/output.txt',
  content: 'Hello World'
});

// List directory
const files = await file_list({
  path: '~/Documents',
  recursive: false
});
```

### Security

- Path allowlist/denylist
- File size limits
- No system file access
- Audit logging

## Tool Permissions

### Per-Session Permissions

```json
{
  "sessions": {
    "main": {
      "tools": {
        "browser": true,
        "camera": true,
        "screen": true,
        "files": true
      }
    },
    "guest": {
      "tools": {
        "browser": false,
        "camera": false,
        "screen": false,
        "files": false
      }
    }
  }
}
```

### Sandboxing

Non-main sessions can run tools in Docker sandbox:

```json
{
  "security": {
    "sandbox": {
      "enabled": true,
      "mode": "docker",
      "image": "clawdbot/sandbox:latest"
    }
  }
}
```

## CLI Commands

```bash
# List available tools
clawdbot tools list

# Check tool status
clawdbot tools status browser

# Test tool
clawdbot tools test camera --capture

# Enable/disable tool
clawdbot tools enable browser
clawdbot tools disable camera
```
