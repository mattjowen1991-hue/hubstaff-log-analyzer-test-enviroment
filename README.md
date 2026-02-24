# 🔮 Hubstaff Client Log Analyzer

A browser-based diagnostic tool for analyzing Hubstaff log files to troubleshoot tracking issues, crashes, network errors, location problems, screenshot issues, and more. Includes a dedicated **Silent App Health Dashboard** for corporate/enterprise deployments.

## 🔒 Privacy First

**All analysis happens locally in your browser.** No data is ever sent to any server. When you close the tab or click "Clear," all data is wiped from memory.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Input Methods](#input-methods)
- [Understanding the Interface](#understanding-the-interface)
- [What the Tool Analyzes](#what-the-tool-analyzes)
- [Key Sections Explained](#key-sections-explained)
- [Silent App Health Dashboard](#silent-app-health-dashboard)
- [Screenshot Health Analysis](#screenshot-health-analysis)
- [Using Plain English Mode](#using-plain-english-mode)
- [Timezone Conversion](#timezone-conversion)
- [Date Filtering](#date-filtering)
- [Search Functionality](#search-functionality)
- [Common Issues & What to Look For](#common-issues--what-to-look-for)
- [Platform-Specific Troubleshooting](#platform-specific-troubleshooting)
- [Understanding Stop Reasons](#understanding-stop-reasons)
- [Job Site & Location Analysis](#job-site--location-analysis)
- [Chrome Extension](#chrome-extension)
- [Tips for Support Agents](#tips-for-support-agents)

---

## Quick Start

1. **Open the analyzer** in any modern web browser (or via the Chrome Extension)
2. **Upload files** or **paste** the contents of your log files
3. **Click "Analyze"** (or press `Ctrl/Cmd + Enter`)
4. **Review** the categorized results, starting with the Quick Summary and Root Cause Analysis

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Multi-File Upload** | Upload multiple log files at once (hubstaff.log, hubstaff.1-9, helper_hubstaff.log, audit.log) — auto-sorted chronologically and merged |
| **Auto-Filter Noise** | Removes routine log lines (mouse coordinates, heartbeats, successful API calls) to surface actual issues |
| **Plain English Mode** | Translates technical log messages into human-readable explanations with actionable advice |
| **Root Cause Analysis** | Automatically identifies the most likely cause of issues and provides step-by-step solutions |
| **Device Dashboard** | Shows at-a-glance status of permissions, location settings, and device state (Android) |
| **Silent App Health Dashboard** | Dedicated diagnostic dashboard for corporate/enterprise silent app deployments with health scoring, lifecycle timeline, and KPI cards |
| **Screenshot Health Analysis** | Detects conditions that cause blank/black screenshots (permissions, antivirus, sleep) even when upload events look normal |
| **Session Tracking** | Identifies START/STOP pairs and calculates actual tracked time vs. log duration |
| **Interactive Timeline** | Visual representation of events over time with clickable markers |
| **Job Site Analysis** | Compares user location against configured job sites with map links and distance calculations |
| **Virtual Scroll Tables** | All data tables use virtual scrolling — smoothly browse thousands of events without performance issues |
| **Simulated Input Detection** | Identifies hardware recognition issues and distinguishes between simulated, injected, and "only injected" input types |
| **Search** | Full-text search across all log lines (including filtered ones) with highlighted results |
| **Chrome Extension** | Install as a browser extension for quick access, keyboard shortcut, and right-click context menu analysis |

### Supported Log Types

This tool works with multiple Hubstaff log file types:

- ✅ `hubstaff.log` — Main client log (desktop & mobile)
- ✅ `hubstaff.1` through `hubstaff.9` — Rotated log files
- ✅ `helper_hubstaff.log` — Helper process log (memory, app detection, screenshot capture)
- ✅ `audit.log` — Audit events (startup, shutdown, tracking, auth — used by Silent App Dashboard)

### Supported Platforms

- ✅ Windows Desktop
- ✅ Mac Desktop
- ✅ Linux Desktop
- ✅ iOS Mobile
- ✅ Android Mobile
- ✅ Silent App (Corporate/Enterprise)

---

## Input Methods

### File Upload (Recommended)

Click the upload area or drag and drop files. Supports uploading **multiple files at once** — the analyzer will:

1. Read all files
2. Extract the first timestamp from each file
3. Sort them chronologically (oldest first)
4. Merge them with file boundary markers (`// === FILE: filename (starts date) ===`)
5. Show the sort order in the UI for verification

Accepted file types: `.log`, `.txt`, `.1` through `.9`

### Paste Text

Switch to the "Paste Text" tab and paste log content directly into the text area.

---

## Understanding the Interface

### Top Controls

| Control | Purpose |
|---------|---------|
| **📁 Upload File / 📋 Paste Text** | Switch between file upload and text paste input |
| **🔍 Analyze** | Parse and analyze the log content |
| **Clear** | Wipe all data from memory (privacy) |
| **Auto-filter noise** | Remove routine log lines that don't help diagnose issues |
| **🎯 Plain English mode** | Show translated explanations instead of raw technical data |
| **Show DEBUG level** | Include DEBUG-level logs (usually unnecessary) |
| **Show TRACE level** | Include TRACE-level logs (very verbose, rarely needed) |

### KPI Dashboard

The top row shows key metrics at a glance:

| Metric | What It Means |
|--------|---------------|
| **Total Lines** | Number of log lines analyzed |
| **Errors** | Count of ERROR-level events |
| **Warnings** | Count of WARN-level events |
| **Tracked Time** | Actual time between START and STOP events |
| **Idle Kept** | Idle time the user chose to keep |
| **Idle Discarded** | Idle time that was rejected |
| **Timezone** | Detected timezone offset from logs |
| **Log Time Span** | Duration covered by the log file |

---

## What the Tool Analyzes

### Event Categories

| Category | What's Captured |
|----------|-----------------|
| **Errors & Critical Issues** | `[ERROR]` events, watchdog hits, helper crashes, fatal errors |
| **Warnings & Anomalies** | `[WARN]` events, discarded time, memory issues, server errors |
| **Screenshots** | Capture events, uploads, failures, and **blank screenshot risk analysis** (permissions, security software, sleep) |
| **Network & API** | HTTP response codes (especially 4xx/5xx), connection issues, SSL/TLS errors, rate limiting |
| **Locations & Job Sites** | Geofence events, permission states, GPS coordinates, visit history with distance calculations |
| **URLs & Applications** | Tracked apps and websites, window titles, Brave Browser detection |
| **Injected / Simulated Input** | Software-generated keyboard/mouse input — categorized as Simulated (hardware recognition), Injected, or Only Injected (no physical input) |
| **Tracking Events** | Resume, idle, discard, startup, start/stop, auto-start/stop events |

### Noise Patterns Filtered

When "Auto-filter noise" is enabled, these routine patterns are removed:

- `WindowsInput.cpp` — Mouse/keyboard coordinates (logged every second)
- `InputExtension.h` — Routine input tracking checks
- `Heart beat` — Keep-alive messages
- `Response: 200/201/204` — Successful API calls
- `Check CURL Response` — Routine network checks
- `StorageIO.*Wrote` — Routine database writes (except Location/TrackedActivity)
- `Storage.h.*Read` — Routine database reads

**Exception:** "Simulating missed input" lines from `WindowsInput.cpp` are always kept — these indicate hardware that Hubstaff can't properly recognize (drawing tablets, gaming peripherals, KVM switches) and can cause unexpectedly high activity levels.

---

## Key Sections Explained

### 🔍 Root Cause Analysis

When Plain English mode is enabled, this box appears at the top with:
- **Primary cause** identified from log patterns
- **Supporting evidence** from the logs
- **Recommended actions** to resolve the issue
- **App version check** against latest known versions across all platforms
- **Screenshot health status** — warns if screenshots may be blank instead of blindly reporting success

### 📱 Device & Location Status (Android)

A dashboard showing:
- **Location Status**: Primary device, services enabled, permissions
- **Permissions**: Foreground/background location, notifications, motion
- **Device State**: Battery optimization, power save mode, WiFi status
- **Issues Detected**: DNS errors, app crashes, job site blocks

### 📋 Quick Summary for Support

Bullet-point findings organized by severity:
- 🔴 **Critical** — Requires immediate attention
- 🟡 **Warning** — Potential issues to investigate
- 🟢 **Info** — Contextual information
- ✅ **Success** — Things working correctly

### ⏱️ Tracking Sessions

A table showing each tracking session with:
- Start time and stop time
- Duration
- Stop reason (User stopped, Went idle, Crashed, etc.)
- Session markers (RESUMED if recovered after crash)
- Log duration vs. tracked time comparison

### 📊 Event Timeline

An interactive visualization showing:
- Errors (red markers)
- Warnings (orange markers)
- Screenshots (purple markers)
- Network events (blue markers)
- Location events (green markers)
- Tracking events (light purple markers)

**Click any marker** to see event details. Use the legend checkboxes to show/hide event types.

### 📸 Screenshots & Screen Capture

Displays all screenshot-related events with a **health analysis panel** at the top showing:
- Capture count, upload count, and failure count
- Blank screenshot risk factors (if detected)
- Actionable remediation steps with links to Hubstaff help articles

See [Screenshot Health Analysis](#screenshot-health-analysis) for details.

### 🤖 Injected / Simulated Input Activity

Categorizes input events into three types:

| Type | Meaning | Concern Level |
|------|---------|---------------|
| **Simulated** | "Simulating missed input" — hardware not recognized | Low — usually a hardware issue (drawing tablets, KVM switches, gaming peripherals) |
| **Injected** | Software-generated input detected alongside physical input | Medium — could be remote desktop or automation tools |
| **Only Injected** | Software-generated input with NO physical input detected | High — investigate further, but check screenshots first |

Includes an inline guide explaining what simulated input means, common causes, and troubleshooting steps.

### 📝 Raw Tracking Events

All tracking-related events (startup, idle, resume, discard, start/stop) in a scrollable table. Uses virtual scrolling — all events are accessible regardless of dataset size.

---

## Silent App Health Dashboard

Automatically appears when a corporate/enterprise silent app is detected in the logs (via `ENTERPRISE_INSTALL`, `CORPORATE_LOGIN`, or `profile corporate` patterns).

### Health Score

A 0–100 health bar with weighted scoring:

| Check | Penalty |
|-------|---------|
| Version outdated (vs latest 1.7.10) | -20 |
| Provision failures (`CORPORATE_PROVISION_ATTEMPT_FAILED`) | -25 |
| Multi-day gaps (app offline >24h) | -15 each |
| Unclean startups (crashes) | -5 each |
| Helper crashes (50+) | -5 to -10 |
| Memory pressure (>90% usage) | -5 to -10 |
| Double-starts (crash-restart) | -10 |
| SSL/TLS errors | up to -10 |
| HTTP 429 rate limiting | up to -15 |
| Screenshot blank risk factors | -5 to -15 |

### KPI Cards

| Card | What It Shows |
|------|---------------|
| **Startups** | Total startups, clean vs. crashed (STARTUP_UNCLEAN) |
| **Shutdowns** | Total clean shutdowns, how many from screen sleep |
| **Multi-Day Gaps** | Periods where the app was offline >24 hours (most common silent app complaint) |
| **Helper Crashes** | Helper process crash count — affects screenshots and app detection |
| **Auth Status** | Token auth success or provision failure |
| **System Memory** | RAM usage from helper_hubstaff.log Client MEM lines (avg/min/max if multiple snapshots) |
| **Auto-Track** | Auto-start count and idle timeout count |
| **Screenshots** | Screenshot health status and blank risk factor count |
| **Rate Limits** | HTTP 429 responses (conditional — only appears when detected) |
| **SSL Errors** | SSL/TLS connection failures (conditional — only appears when detected) |

Every KPI card has a **hover tooltip** explaining what the metric means, why it matters, and what to do about it.

### Health Checklist

A pass/warn/fail checklist covering all diagnostic checks. Each check includes a detailed tooltip with explanation and actionable guidance.

### Lifecycle Timeline

A collapsible section showing the app's startup→shutdown cycles:

- Each cycle shows: date, uptime duration, tracked time, status tags
- Expandable detail table with color-coded event badges
- **Gap detection** between cycles:
  - Overnight gaps: moon icon with duration
  - Multi-day gaps: red dashed alert boxes with day count
- **Tags per cycle**: `SCREEN SLEEP`, `CRASHED START`, `NO SHUTDOWN`, `RESUME IGNORED`, `AUTH FAILED`, `STOP ERROR`
- Event highlighting: important events (screen sleep, resume ignored, auth fail) have red backgrounds; routine events are dimmed

### Extended Offline Periods

A table listing all multi-day gaps with:
- From/To dates
- Duration in days
- Gap severity highlighting

### Resume Handling

Displays resume threshold configuration (keep/discard values) and resume events:
- `RESUME_DETECTED` / `RESUME_IGNORED` / `RESUME_TRACKING`
- Double-start detection (START without prior STOP = crash-restart)
- `AUTO_START_STOP` events (start, stop, no_activity)
- `STOP_ERROR` and `PENDING_DETECTED` events

---

## Screenshot Health Analysis

The analyzer goes beyond just counting screenshot events. It detects **conditions that cause blank or black screenshots** even when the upload process appears successful.

### Why This Matters

When Hubstaff uploads a screenshot, the log shows "Uploading Screen" — but this only means data was sent to the server. It does **not** confirm the image contains actual content. Without proper permissions, the screenshot may show only the desktop wallpaper or a completely black image.

### Risk Factors Detected

| Risk Factor | Severity | What It Means |
|-------------|----------|---------------|
| **Screen Recording Permission Issue** | 🔴 Critical | macOS permission denied — all screenshots will be blank desktop backgrounds |
| **Helper Crashes Near Capture** | 🔴 Critical | Helper process crashed within 60s of a capture — screenshot is almost certainly blank |
| **Screenshot Capture/Upload Failures** | 🔴 Critical | Explicit errors in the logs |
| **Screen Sleep During Tracking** | 🟡 Warning | Monitor went to sleep while tracking was active — screenshots at that moment will be black |
| **Security Software Detected** | 🟡 Warning | McAfee, Norton, Webroot, Avast, Bitdefender, VirtualBox, etc. found in logs |
| **Excessive Helper Crashes** | 🟡 Warning | 50+ helper crashes — missed or corrupted screenshots likely |
| **Screenshot Upload Rate Limited** | 🟡 Warning | HTTP 429 on /screens endpoint — uploads rejected |
| **Uploads Without Captures** | 🟡 Warning | Upload events but no capture events — possible placeholder images |
| **macOS No Permission Confirmation** | 🔵 Info | macOS device with uploads but no log evidence permission was granted |

### Where Results Appear

- **Screenshots section** — health panel with stats and risk factors
- **Root Cause Analysis** — warns "Screenshots Uploading — But May Be Blank" instead of false success
- **Silent App Dashboard** — Screenshots KPI card and health check

### Resolution Steps

1. Check the **Activity page** in Hubstaff dashboard — are screenshots actually blank?
2. **macOS:** System Settings → Privacy & Security → Screen & System Audio Recording → toggle Hubstaff ON
3. **Windows:** Check for web-shield/antivirus software (McAfee, Norton, Webroot) or VirtualBox
4. **Sleep:** Computer going to sleep during tracking will produce black screenshots
5. Reference: [Hubstaff: Blank/Black Screenshots](https://support.hubstaff.com/blank-black-screenshot-images-activity-page/) · [macOS Permissions Guide](https://support.hubstaff.com/how-to-give-hubstaff-screen-capture-permissions-on-macos/)

---

## Using Plain English Mode

When enabled (recommended), Plain English mode:

1. **Translates technical messages** into understandable explanations
2. **Provides actionable advice** for each issue
3. **Shows the Root Cause Analysis** box
4. **Adds context** to session stop reasons

### Example Translations

| Technical Log | Plain English |
|---------------|---------------|
| `main_watchdog hit` | ⚠️ The app froze or became unresponsive |
| `Helper died` | 🔌 The browser extension crashed |
| `Response: 401` | 🔐 Authentication failed - user may be logged out |
| `kCLErrorDomain Code=1` | 📍 iOS Location Permission Denied |
| `TRACKING_NOT_STARTED` | 🚫 Timer Blocked - Not At Required Job Site |
| `Uploading Screen` | 📸 Screenshot data is uploading — does not confirm image is valid |
| `Simulating missed input` | 🔧 Hardware not recognized — input simulated |
| `Wrote ScreenData` | 📸 Screenshot data written locally — upload pending |

---

## Timezone Conversion

### Using the Timezone Feature

1. **Check** "Show in user's timezone"
2. **Enter** the user's UTC offset (e.g., `-05:00` for EST, `+05:30` for IST)
3. All timestamps will be converted and marked with a **★**

### Finding the User's Timezone

The tool auto-detects timezone from log lines containing `TZ Offset`. If present, it auto-fills the offset field.

---

## Date Filtering

### Narrowing Results by Date

1. Use the **"Filter dates"** inputs to set a date range
2. Only events within that range will be analyzed
3. Click **"Clear"** to remove the filter

This is useful when analyzing logs that span multiple days or when multiple files are merged.

---

## Search Functionality

### Search Tips

The search box searches **all** log lines, including filtered ones. Results use virtual scrolling — all matches are shown, not just the first 200.

| Search Term | What It Finds |
|-------------|---------------|
| `error` | All error mentions |
| `URL:` | Tracked websites |
| `TITLE:` | Window titles |
| `Discard` | Rejected time |
| `screenshot` | Screen capture events |
| `watchdog` | App freeze events |
| `Response: 5` | Server errors (5xx) |
| `Response: 4` | Client errors (4xx) |
| `Helper died` | Helper process crashes |
| `Simulating missed` | Hardware input simulation events |
| `CAPTURE_DESKTOP` | Screen sleep / monitor off events |
| `CORPORATE_PROVISION` | Silent app provisioning events |

Results automatically expand in the **Search Results** section with highlighted matches.

---

## Common Issues & What to Look For

### Timer Stops Unexpectedly

| Indicator | Likely Cause |
|-----------|--------------|
| Stop reason: "User stopped" | User clicked stop (or accidental click) |
| Stop reason: "Went idle" | Idle timeout triggered |
| Stop reason: "⚠️ Crashed" | App crashed, no stop event found |
| Stop reason: "📍 Left Job Site" | User left geofenced area |
| STARTUP_UNCLEAN events | App was killed by OS or crashed |

### Time Not Tracking

| Indicator | Likely Cause |
|-----------|--------------|
| `TRACKING_NOT_STARTED` | User not at required job site |
| `non-primary device` | Different device is set as primary |
| `location unavailable/denied` | Location permissions not set to "Always" |
| `Response: 401/403` | Authentication issue - need to re-login |

### Screenshots Not Capturing or Blank

| Indicator | Likely Cause |
|-----------|--------------|
| No screenshot events | Feature may be disabled |
| `screenshot fail/error` | Permission or capture issue |
| Screenshot events present but images blank | Screen recording permission not granted (macOS), antivirus interference (Windows), or computer sleeping during tracking |
| High helper crash count | Helper process (which captures screenshots) is unstable |
| `Response: 429` on /screens | Screenshot uploads being rate limited |

### Silent App Not Tracking

| Indicator | Likely Cause |
|-----------|--------------|
| Multi-day gaps in lifecycle timeline | App shut down and didn't restart (common bug in pre-1.7.10 versions) |
| `CORPORATE_PROVISION_ATTEMPT_FAILED` | Auth failure — can't connect to organization |
| High unclean startup count | App crashing repeatedly |
| No AUTO_START_STOP events | Auto-track policy may not be configured |
| Screen sleep → shutdown chain | PC sleep triggers shutdown; app should restart on wake |

### Job Sites Not Working

| Indicator | Likely Cause |
|-----------|--------------|
| `must visit` errors | User not physically at site |
| Sites with ≤50m radius | Radius too small for GPS accuracy |
| `kCLErrorDomain Code=1` | iOS location permission denied |
| `BACKGROUND_LOCATION enabled=false` | Android background location not granted |
| Empty "currently entered sites" | Never detected inside any site |

---

## Platform-Specific Troubleshooting

### iOS Location Issues

**Required Settings:**
1. **Location Services**: Settings → Privacy & Security → Location Services → ON
2. **Hubstaff Permission**: Settings → Hubstaff → Location → **"Always"**
3. **Precise Location**: Settings → Hubstaff → Precise Location → ON
4. **Background Refresh**: Settings → General → Background App Refresh → Hubstaff → ON

**Important:** "While Using" permission is **NOT** sufficient for background tracking.

### Android Location Issues

**Required Settings:**
1. **Location Permission**: Settings → Apps → Hubstaff → Permissions → Location → **"Allow all the time"**
2. **Location Mode**: Enable "High accuracy" mode
3. **Battery Optimization**: Settings → Apps → Hubstaff → Battery → **"Unrestricted"**

**Brand-Specific Battery Settings:**

| Brand | Critical Steps |
|-------|----------------|
| **Samsung** | Device Care → Battery → App power management → Hubstaff → Unrestricted. Remove from "Sleeping apps" AND "Deep sleeping apps" |
| **Xiaomi/MIUI** | Apps → Manage Apps → Hubstaff → Autostart ON. Battery → Hubstaff → No restrictions |
| **Huawei** | Battery → App Launch → Hubstaff → Manually Manage with all toggles ON |
| **OnePlus** | Battery → Battery Optimization → Hubstaff → Don't optimize |
| **OPPO/Realme** | App Management → Hubstaff → Allow Auto-start + disable battery optimization |

### Windows Desktop Issues

**Common Causes:**
- Browser extension crashed → Reinstall extension, restart browser
- Watchdog hits → App freezing, check system resources
- Helper died → Extension communication lost
- Blank screenshots → Check for McAfee, Norton, Webroot, or VirtualBox interference

### Mac Desktop Issues

**Screenshot / App Tracking Not Working:**
- Screen Recording permission must be granted: System Settings → Privacy & Security → Screen & System Audio Recording → Hubstaff ON
- May require quit & reopen after granting permission
- For silent app: distribute `.mobileconfig` file before installation to pre-approve permissions
- If permission keeps resetting: known macOS bug on some versions — remove and re-add Hubstaff in Screen Recording settings

### Brave Browser Note

⚠️ **Hubstaff does not support URL tracking in Brave Browser.** The app name will be tracked, but visited URLs will not appear in reports. For URL tracking, use Chrome, Edge, Firefox, or Island Browser.

---

## Understanding Stop Reasons

| Stop Reason | Meaning | Is This a Problem? |
|-------------|---------|-------------------|
| **User stopped** | Normal stop logged by app as user-initiated | No - this is expected behavior |
| **Went idle** | Idle timeout triggered after inactivity | No - working as designed |
| **⚠️ Crashed** | No stop event found, app likely crashed | Yes - investigate why |
| **Config/Limit** | Policy stopped tracking (time limit, schedule) | Check organization settings |
| **📍 Left Job Site** | User exited geofenced area | Expected if job site rules active |
| **App closed** | App was shut down normally | No - normal behavior |

### What "User stopped" Does NOT Mean

- ❌ Does NOT mean the app crashed
- ❌ Does NOT mean there was an error
- ❌ Does NOT mean timezone issues caused it
- ❌ Does NOT mean network problems caused it

If the user disputes stopping manually, consider: accidental click, trackpad sensitivity, another person with access, or remote control software.

---

## Job Site & Location Analysis

### Understanding the Job Sites Section

When job site data is present, you'll see:

1. **Job Sites Configuration** — List of all configured sites with:
   - Site name
   - Radius (⚠️ warning if ≤50m)
   - GPS coordinates

2. **User's Last Known Location** — Most recent GPS position with accuracy

3. **Job Site Visit History** — Geofence enter/exit events with:
   - User's coordinates at the time
   - Distance to nearest configured site
   - Whether they were inside or outside the radius
   - **Map links** to view locations in Google Maps

### Map Links

Each visit history entry includes clickable links to:
- **View User Location** — Where the user was when the event triggered
- **View Site Location** — Where the job site is configured

This helps identify if:
- The job site pin is in the wrong location
- The user was actually at the site but outside the radius
- GPS accuracy was too poor

### Recommended Job Site Radius

| Scenario | Recommended Radius |
|----------|-------------------|
| Outdoor work | 50-100m |
| Indoor office | 100-150m |
| Large facility | 150-200m |
| Poor GPS area | 200m+ |

---

## Chrome Extension

The analyzer is available as a Chrome extension for quick access.

### Installation

1. Download the extension files (manifest.json, analyzer.html, icons)
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the extension folder

### Usage

Three ways to use:

| Method | How |
|--------|-----|
| **Click icon** | Click the purple H icon in the toolbar → opens analyzer in a new tab |
| **Keyboard shortcut** | `Cmd+Shift+H` (Mac) / `Ctrl+Shift+H` (Windows) |
| **Right-click** | Select text → right-click → "Analyze with Hubstaff Log Analyzer" → auto-pastes and analyzes |

All features work identically to the web version.

---

## Tips for Support Agents

### Workflow for Log Analysis

1. **Upload log files** (drag & drop multiple files for best results)
2. **Check Root Cause Analysis** box first (if Plain English mode is on)
3. **Check Silent App Dashboard** if it appears (corporate/enterprise deployments)
4. **Review Quick Summary** for prioritized findings
5. **Check Screenshot Health** if the user reports blank/missing screenshots
6. **Check Device Dashboard** (Android) for permission/setting issues
7. **Review Tracking Sessions** to understand what was tracked vs. what wasn't
8. **Use Search** for specific patterns if needed
9. **Check Visit History** for job site issues with map links

### Questions to Ask the User

Based on findings, you may need to clarify:

| Finding | Question to Ask |
|---------|-----------------|
| Short "User stopped" sessions | "Did you intentionally stop the timer? Could someone else have accessed your computer?" |
| Battery optimization enabled | "Can you check if Hubstaff is set to 'Unrestricted' in your battery settings?" |
| Job site blocks | "Were you physically at the job site when trying to start the timer?" |
| Network errors | "Did you have a working internet connection at the time?" |
| Multiple STARTUP_UNCLEAN | "Is your phone set to kill background apps? What brand/model is it?" |
| Blank screenshot risk factors | "Are you running any antivirus software? Can you check if Hubstaff has screen recording permission?" |
| Silent app multi-day gaps | "Does the computer go to sleep at the end of the day? Is Hubstaff set to auto-start on boot?" |
| High simulated input | "Are you using a drawing tablet, KVM switch, or non-standard input device?" |

### Key Log Patterns Cheat Sheet

```
[ERROR]                  → Something went wrong
[WARN]                   → Potential issue
main_watchdog hit        → App froze
Helper died              → Helper process crashed (affects screenshots, app/URL detection)
Response: 4xx            → Client error (auth, not found)
Response: 5xx            → Server error (outage)
Response: 429            → Rate limited (too many requests)
Discard=1                → Time was rejected
STARTUP_CLEAN            → App started normally
STARTUP_UNCLEAN          → App crashed or was killed previously
kCLErrorDomain Code=1    → iOS location denied
TRACKING_NOT_STARTED     → Timer blocked (job site)
Could not resolve host   → No internet connection
isIgnoringBatteryOptimization: =false → Battery opt ON (bad)
CAPTURE_DESKTOP "No monitors detected" → Screen sleep / monitor off
CORPORATE_PROVISION_ATTEMPT_FAILED     → Silent app auth failure
Simulating missed input  → Hardware not recognized
Uploading Screen         → Screenshot uploading (doesn't confirm it's valid)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Analyze logs |
| `Cmd+Shift+H` / `Ctrl+Shift+H` | Open analyzer (Chrome Extension) |

---

## Technical Notes

### Virtual Scrolling

All data tables (screenshots, network, locations, apps, injected input, tracking, search results) use virtual scrolling for datasets over 100 rows. Only rows visible in the viewport plus a small buffer are rendered — this means even logs with thousands of events scroll smoothly without any performance impact.

### How Sessions Are Detected

The tool looks for `START_TRACKING` / `STOP_TRACKING` pairs (or equivalent events) and calculates:
- Session duration
- Start reason (user started, resumed after crash)
- Stop reason (user stopped, went idle, crashed, etc.)

Sessions without a matching STOP event are marked as "Crashed."

### How Idle Time Is Calculated

The tool captures:
- `IDLE_WAKE` events with duration
- `KeepIdle` / `StopTracking` decisions
- Totals kept vs. discarded idle time

### Log Duration vs. Tracked Time

The log file may span hours or days, but only time between START and STOP events counts as tracked time. The difference is NOT lost time — it's just background app activity (URL detection, system monitoring) that occurs when the timer isn't running.

### Silent App Auto-Detection

The analyzer auto-detects corporate/enterprise deployments by looking for:
- `ENTERPRISE_INSTALL` in log lines
- `CORPORATE_LOGIN` events
- `profile corporate` patterns

When detected, the Silent App Health Dashboard appears automatically with diagnostics tailored to silent app issues.

### Health Score Algorithm

The silent app health score starts at 100 and applies weighted penalties based on detected issues. The algorithm prioritizes issues by their real-world impact — provision failures (-25) and outdated versions (-20) are weighted most heavily because they affect whether the app can track at all.

---

## Troubleshooting the Tool Itself

| Issue | Solution |
|-------|----------|
| Nothing happens when clicking Analyze | Check if log content was pasted or files uploaded |
| Results look wrong | Try disabling "Auto-filter noise" |
| Missing data | Enable "Show DEBUG level" for more detail |
| Timeline not showing | Need at least 2 timestamped events |
| Timezone not detected | Manually enter the offset |
| Silent App Dashboard not appearing | Make sure audit.log is included — dashboard requires audit events |
| Scrolling feels slow | Shouldn't happen with virtual scroll — try refreshing the page |

---

## Privacy & Security

- ✅ **100% client-side** — No server communication
- ✅ **No storage** — Data exists only in memory while the tab is open
- ✅ **No tracking** — No analytics or telemetry
- ✅ **Auto-clear on close** — Data is wiped when you leave the page
- ✅ **Manual clear** — Click "Clear" to wipe data immediately

---

## Version History

### Current Version

- **Screenshot Health Analysis** — Blank/black screenshot risk detection (permissions, antivirus, sleep, helper crashes)
- **Virtual Scroll Tables** — All data tables support smooth scrolling through thousands of events
- **Silent App Health Dashboard** — Health scoring, lifecycle timeline, KPI cards with tooltips, resume handling, system resources
- **Multi-File Upload** — Upload and merge multiple log files, auto-sorted chronologically
- **Simulated Input Detection** — Hardware recognition issues categorized and explained
- **Chrome Extension** — Extension icon, keyboard shortcut, and right-click context menu
- Root Cause Analysis engine
- Device Status Dashboard (Android)
- Job Site Visit History with map links and distance calculations
- Geofence event analysis with Haversine distance calculations
- Timezone conversion support with auto-detection
- Date range filtering
- Session tracking with idle time analysis
- Plain English translations for 50+ log patterns
- Brave Browser URL tracking detection warning
- App version detection across all platforms (Windows, Mac, Linux, iOS, Android, Chrome Extension, Silent App)

---

## Support

This tool is designed for internal Hubstaff support use. For questions about the tool itself, contact your support team lead.

For questions about Hubstaff products, refer to:
- [Hubstaff Help Center](https://support.hubstaff.com)
- [Hubstaff Status Page](https://status.hubstaff.com)
