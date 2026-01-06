# 🔮 Hubstaff Client Log Analyzer

A browser-based diagnostic tool for analyzing `hubstaff.log` files to troubleshoot tracking issues, crashes, network errors, location problems, and more.

## 🔒 Privacy First

**All analysis happens locally in your browser.** No data is ever sent to any server. When you close the tab or click "Clear," all data is wiped from memory.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Understanding the Interface](#understanding-the-interface)
- [What the Tool Analyzes](#what-the-tool-analyzes)
- [Key Sections Explained](#key-sections-explained)
- [Using Plain English Mode](#using-plain-english-mode)
- [Timezone Conversion](#timezone-conversion)
- [Date Filtering](#date-filtering)
- [Search Functionality](#search-functionality)
- [Common Issues & What to Look For](#common-issues--what-to-look-for)
- [Platform-Specific Troubleshooting](#platform-specific-troubleshooting)
- [Understanding Stop Reasons](#understanding-stop-reasons)
- [Job Site & Location Analysis](#job-site--location-analysis)
- [Tips for Support Agents](#tips-for-support-agents)

---

## Quick Start

1. **Open the analyzer** in any modern web browser
2. **Paste** the contents of a `hubstaff.log` file into the text area
3. **Click "Analyze"** (or press `Ctrl/Cmd + Enter`)
4. **Review** the categorized results, starting with the Quick Summary

---

## Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Auto-Filter Noise** | Removes routine log lines (mouse coordinates, heartbeats, successful API calls) to surface actual issues |
| **Plain English Mode** | Translates technical log messages into human-readable explanations with actionable advice |
| **Root Cause Analysis** | Automatically identifies the most likely cause of issues and provides step-by-step solutions |
| **Device Dashboard** | Shows at-a-glance status of permissions, location settings, and device state (Android) |
| **Session Tracking** | Identifies START/STOP pairs and calculates actual tracked time vs. log duration |
| **Interactive Timeline** | Visual representation of events over time with clickable markers |
| **Job Site Analysis** | Compares user location against configured job sites with map links |
| **Search** | Full-text search across all log lines (including filtered ones) |

### Supported Log Types

This tool is designed for **`hubstaff.log`** files (detailed client logs), not `audit.log` files. It works with logs from:

- ✅ Windows Desktop
- ✅ Mac Desktop
- ✅ Linux Desktop
- ✅ iOS Mobile
- ✅ Android Mobile

---

## Understanding the Interface

### Top Controls

| Control | Purpose |
|---------|---------|
| **🔍 Analyze** | Parse and analyze the pasted log content |
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
| **Screenshots** | Capture events, upload attempts, failures |
| **Network & API** | HTTP response codes (especially 4xx/5xx), connection issues |
| **Locations & Job Sites** | Geofence events, permission states, GPS coordinates |
| **URLs & Applications** | Tracked apps and websites, window titles |
| **Injected Input** | Software-generated keyboard/mouse input (remote desktop, automation) |
| **Tracking Events** | Resume, idle, discard, startup, start/stop events |

### Noise Patterns Filtered

When "Auto-filter noise" is enabled, these routine patterns are removed:

- `WindowsInput.cpp` - Mouse/keyboard coordinates (logged every second)
- `InputExtension.h` - Routine input tracking checks
- `Heart beat` - Keep-alive messages
- `Response: 200/201/204` - Successful API calls
- `Check CURL Response` - Routine network checks
- `StorageIO.*Wrote` - Routine database writes (except Location/TrackedActivity)
- `Storage.h.*Read` - Routine database reads

---

## Key Sections Explained

### 🔍 Root Cause Analysis

When Plain English mode is enabled, this box appears at the top with:
- **Primary cause** identified from log patterns
- **Supporting evidence** from the logs
- **Recommended actions** to resolve the issue

### 📱 Device & Location Status (Android)

A dashboard showing:
- **Location Status**: Primary device, services enabled, permissions
- **Permissions**: Foreground/background location, notifications, motion
- **Device State**: Battery optimization, power save mode, WiFi status
- **Issues Detected**: DNS errors, app crashes, job site blocks

### 📋 Quick Summary for Support

Bullet-point findings organized by severity:
- 🔴 **Critical** - Requires immediate attention
- 🟡 **Warning** - Potential issues to investigate
- 🟢 **Info** - Contextual information
- ✅ **Success** - Things working correctly

### ⏱️ Tracking Sessions

A table showing each tracking session with:
- Start time and stop time
- Duration
- Stop reason (User stopped, Went idle, Crashed, etc.)
- Session markers (RESUMED if recovered after crash)

### 📊 Event Timeline

An interactive visualization showing:
- Errors (red markers)
- Warnings (orange markers)
- Screenshots (purple markers)
- Network events (blue markers)
- Location events (green markers)
- Tracking events (light purple markers)

**Click any marker** to see event details.

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

This is useful when analyzing logs that span multiple days.

---

## Search Functionality

### Search Tips

The search box searches **all** log lines, including filtered ones.

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

Results automatically expand in the **Search Results** section (max 200 shown).

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

### Screenshots Not Capturing

| Indicator | Likely Cause |
|-----------|--------------|
| No screenshot events | Feature may be disabled |
| `screenshot fail/error` | Permission or capture issue |
| `Response: 5xx` with screenshot | Upload failed due to server error |

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

1. **Job Sites Configuration** - List of all configured sites with:
   - Site name
   - Radius (⚠️ warning if ≤50m)
   - GPS coordinates

2. **User's Last Known Location** - Most recent GPS position with accuracy

3. **Job Site Visit History** - Geofence enter/exit events with:
   - User's coordinates at the time
   - Distance to nearest configured site
   - Whether they were inside or outside the radius
   - **Map links** to view locations in Google Maps

### Map Links

Each visit history entry includes clickable links to:
- **View User Location** - Where the user was when the event triggered
- **View Site Location** - Where the job site is configured

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

## Tips for Support Agents

### Workflow for Log Analysis

1. **Paste logs** and click Analyze
2. **Check Root Cause Analysis** box first (if Plain English mode is on)
3. **Review Quick Summary** for prioritized findings
4. **Check Device Dashboard** (Android) for permission/setting issues
5. **Review Tracking Sessions** to understand what was tracked vs. what wasn't
6. **Use Search** for specific patterns if needed
7. **Check Visit History** for job site issues with map links

### Questions to Ask the User

Based on findings, you may need to clarify:

| Finding | Question to Ask |
|---------|-----------------|
| Short "User stopped" sessions | "Did you intentionally stop the timer? Could someone else have accessed your computer?" |
| Battery optimization enabled | "Can you check if Hubstaff is set to 'Unrestricted' in your battery settings?" |
| Job site blocks | "Were you physically at the job site when trying to start the timer?" |
| Network errors | "Did you have a working internet connection at the time?" |
| Multiple STARTUP_UNCLEAN | "Is your phone set to kill background apps? What brand/model is it?" |

### Key Log Patterns Cheat Sheet

```
[ERROR]                  → Something went wrong
[WARN]                   → Potential issue
main_watchdog hit        → App froze
Helper died              → Browser extension crashed
Response: 4xx            → Client error (auth, not found)
Response: 5xx            → Server error (outage)
Discard=1                → Time was rejected
STARTUP_UNCLEAN          → App crashed or was killed
kCLErrorDomain Code=1    → iOS location denied
TRACKING_NOT_STARTED     → Timer blocked (job site)
Could not resolve host   → No internet connection
isIgnoringBatteryOptimization: =false → Battery opt ON (bad)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Analyze logs |

---

## Technical Notes

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

The log file may span hours or days, but only time between START and STOP events counts as tracked time. The difference is NOT lost time—it's just background app activity (URL detection, system monitoring) that occurs when the timer isn't running.

---

## Troubleshooting the Tool Itself

| Issue | Solution |
|-------|----------|
| Nothing happens when clicking Analyze | Check if log content was pasted |
| Results look wrong | Try disabling "Auto-filter noise" |
| Missing data | Enable "Show DEBUG level" for more detail |
| Timeline not showing | Need at least 2 timestamped events |
| Timezone not detected | Manually enter the offset |

---

## Privacy & Security

- ✅ **100% client-side** - No server communication
- ✅ **No storage** - Data exists only in memory while the tab is open
- ✅ **No tracking** - No analytics or telemetry
- ✅ **Auto-clear on close** - Data is wiped when you leave the page
- ✅ **Manual clear** - Click "Clear" to wipe data immediately

---

## Version History

### Current Version

- Root Cause Analysis engine
- Device Status Dashboard (Android)
- Job Site Visit History with map links
- Geofence event analysis with distance calculations
- Timezone conversion support
- Date range filtering
- Session tracking with idle time analysis
- Plain English translations for 50+ log patterns
- Brave Browser detection warning
- App version detection across all platforms

---

## Support

This tool is designed for internal Hubstaff support use. For questions about the tool itself, contact your support team lead.

For questions about Hubstaff products, refer to:
- [Hubstaff Help Center](https://support.hubstaff.com)
- [Hubstaff Status Page](https://status.hubstaff.com)
