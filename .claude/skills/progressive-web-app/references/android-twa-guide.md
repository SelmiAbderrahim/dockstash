# Android TWA Guide - Deep Dive

## Overview

The Android Trusted Web Activity (TWA) wrapper at `mobile/android/` packages the ServerlessBase PWA as a native Android app. It uses Chrome Custom Tabs under the hood, verified by Digital Asset Links, to display the web app full-screen without browser chrome.

## Project Structure

```
mobile/android/
├── twa-manifest.json              # TWA configuration (source of truth)
├── keystore/upload-keystore.jks   # Signing key
├── app/
│   ├── build.gradle               # App-level build config
│   └── src/main/
│       ├── AndroidManifest.xml    # App manifest
│       ├── res/
│       │   ├── drawable/
│       │   │   ├── splash.xml         # Splash screen (MUST have image layer)
│       │   │   └── splash_icon.png    # Splash icon
│       │   ├── mipmap-*/ic_launcher.png  # App icons (5 densities)
│       │   ├── values/
│       │   │   ├── colors.xml
│       │   │   ├── strings.xml
│       │   │   └── styles.xml
│       │   └── xml/
│       │       ├── filepaths.xml      # FileProvider paths (MUST include twa_splash/)
│       │       └── shortcuts.xml      # App shortcuts
│       └── java/com/serverlessbase/app/
├── build.gradle                   # Root build config
├── settings.gradle
├── gradle.properties
├── gradlew / gradlew.bat          # Gradle wrapper
└── gradle/wrapper/                # Gradle wrapper JARs
```

## Build Environment

| Tool | Path | Version |
|------|------|---------|
| JDK | `/usr/lib/jvm/java-17-openjdk-amd64` | 17 |
| Android SDK | `/home/rahim/android-sdk` | Latest |
| Gradle | `./gradlew` (wrapper) | 7.x+ |

### Build Command

```bash
cd mobile/android
export ANDROID_HOME=/home/rahim/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

## TWA Manifest Fields

`mobile/android/twa-manifest.json` is the configuration source:

| Field | Value | Description |
|-------|-------|-------------|
| `packageId` | `com.serverlessbase.app` | Android package identifier |
| `host` | `serverlessbase.com` | PWA host domain |
| `name` | `ServerlessBase` | Full app name |
| `launcherName` | `ServerlessBase` | Home screen name |
| `display` | `standalone` | Display mode |
| `themeColor` | `#0f172a` | Status bar color |
| `backgroundColor` | `#ffffff` | Splash screen background |
| `enableNotifications` | `true` | Push notification support |
| `startUrl` | `/` | Entry point URL |
| `iconUrl` | `https://serverlessbase.com/pwa-512x512.png` | App icon |
| `maskableIconUrl` | `https://serverlessbase.com/maskable-icon-512x512.png` | Adaptive icon |
| `appVersionCode` | `1` | Integer version (increment for updates) |
| `appVersionName` | `1.0.0` | Display version |
| `minSdkVersion` | `23` | Android 6.0+ |
| `orientation` | `any` | Portrait + landscape |

### Manifest/Web Manifest Sync

When modifying the web manifest in `vite.config.mjs`, these fields MUST be synced to `twa-manifest.json`:

| Web Manifest | TWA Manifest |
|-------------|-------------|
| `name` | `name` |
| `short_name` | `launcherName` |
| `theme_color` | `themeColor`, `themeColorDark` |
| `background_color` | `backgroundColor` |
| `start_url` | `startUrl` |
| `display` | `display` |
| `shortcuts[].name` | `shortcuts[].name` |
| `shortcuts[].url` | `shortcuts[].url` |

## Critical Rules (Crash Prevention)

These rules are documented in `.claude/rules/android-twa-patterns.md` and are critical:

### 1. Splash Drawable MUST Have Image Layer

```xml
<!-- WRONG - crashes: color has 0x0 dimensions -->
<layer-list>
    <item android:drawable="@color/backgroundColor" />
</layer-list>

<!-- CORRECT - has an actual image with dimensions -->
<layer-list>
    <item android:drawable="@color/backgroundColor" />
    <item
        android:drawable="@drawable/splash_icon"
        android:gravity="center"
        android:width="192dp"
        android:height="192dp" />
</layer-list>
```

### 2. FileProvider MUST Include twa_splash/

```xml
<!-- CORRECT - includes both paths -->
<paths>
    <files-path name="twa_image" path="twa_image/" />
    <files-path name="twa_splash" path="twa_splash/" />
</paths>
```

### 3. Launcher Icons MUST Be Valid PNGs

| Density | Size | Path |
|---------|------|------|
| mdpi | 48x48 | `mipmap-mdpi/ic_launcher.png` |
| hdpi | 72x72 | `mipmap-hdpi/ic_launcher.png` |
| xhdpi | 96x96 | `mipmap-xhdpi/ic_launcher.png` |
| xxhdpi | 144x144 | `mipmap-xxhdpi/ic_launcher.png` |
| xxxhdpi | 192x192 | `mipmap-xxxhdpi/ic_launcher.png` |

## Digital Asset Links

For the TWA to display full-screen (without browser bar), the domain must verify ownership via Digital Asset Links.

### Setup

Host this file at `https://serverlessbase.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.serverlessbase.app",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]
  }
}]
```

### Get Certificate Fingerprint

```bash
keytool -list -v -keystore keystore/upload-keystore.jks -alias serverlessbase
# Enter password: serverlessbase123
# Look for SHA-256 fingerprint
```

## Signing Keystore

| Property | Value |
|----------|-------|
| Path | `mobile/android/keystore/upload-keystore.jks` |
| Alias | `serverlessbase` |
| Password | `serverlessbase123` |

**NEVER commit keystore passwords to public repos.** For production, use Gradle properties or environment variables.

## Version Bumping

When releasing a new version:

1. Increment `appVersionCode` (integer, must always increase)
2. Update `appVersionName` (semantic version for display)
3. Rebuild: `./gradlew assembleRelease`
4. Sign with upload key
5. Upload to Play Console

## Pre-Build Checklist

- [ ] `res/drawable/splash.xml` has an image layer (not color-only)
- [ ] `res/drawable/splash_icon.png` exists and is a valid PNG
- [ ] `res/xml/filepaths.xml` includes `twa_splash/` path
- [ ] All `mipmap-*/ic_launcher.png` are valid PNGs at correct sizes
- [ ] `keystore/upload-keystore.jks` exists
- [ ] `ANDROID_HOME` and `JAVA_HOME` are set
- [ ] `twa-manifest.json` is synced with web manifest
- [ ] `assetlinks.json` is deployed at `/.well-known/` on the domain
