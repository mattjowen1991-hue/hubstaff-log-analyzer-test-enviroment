    function generateSummary(data) {
      const findings = [];
      
      // === TRACKING SUMMARY ===
      const totalTrackedSecs = data.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const logDurationSecs = (data.endTime - data.startTime) / 1000;
      
      if (data.sessions.length > 0) {
        const crashedSessions = data.sessions.filter(s => s.stopReason === 'CRASHED' || s.stopReason === 'LOG_END');
        const idleStops = data.sessions.filter(s => s.stopReason === 'IDLE');
        const resumedStarts = data.sessions.filter(s => s.startReason === 'RESUMED');
        const userStops = data.sessions.filter(s => s.stopReason === 'USER');
        
        let sessionDesc = `Found ${data.sessions.length} tracking session${data.sessions.length > 1 ? 's' : ''} totaling <strong>${fmtDuration(totalTrackedSecs)}</strong>.`;
        if (resumedStarts.length > 0) sessionDesc += ` ${resumedStarts.length} session(s) were recovered after a crash.`;
        if (idleStops.length > 0) sessionDesc += ` ${idleStops.length} stopped due to idle timeout.`;
        
        findings.push({
          severity: crashedSessions.length > 0 ? 'warning' : 'info',
          icon: '⏱️',
          title: `Tracked Time: ${fmtDuration(totalTrackedSecs)}`,
          description: sessionDesc,
          action: crashedSessions.length > 0 ? 'Some sessions may have ended unexpectedly. Check the Sessions table below for details.' : null,
          techDetail: null
        });
        
        // === LOG DURATION VS TRACKED TIME COMPARISON ===
        if (logDurationSecs > 600 && totalTrackedSecs < logDurationSecs * 0.1) {
          // Log covers significant time but very little was tracked
          findings.push({
            severity: 'info',
            icon: '📊',
            title: `Log Duration: ${fmtDuration(logDurationSecs)} vs Tracked: ${fmtDuration(totalTrackedSecs)}`,
            description: `The log file spans <strong>${fmtDuration(logDurationSecs)}</strong>, but only <strong>${fmtDuration(totalTrackedSecs)}</strong> was actually tracked. This is normal - the app continues logging background activity (app focus, URL detection, system monitoring) even when the timer is not running. <strong>Only time between START and STOP events counts as tracked time.</strong>`,
            action: 'The difference does NOT mean time was lost. Background logs help with diagnostics but do not represent paid time.',

          });
        }
        
        // === USER STOP EXPLANATION ===
        if (userStops.length > 0) {
          const shortSessions = userStops.filter(s => s.duration < 30);
          if (shortSessions.length > 0) {
            findings.push({
              severity: 'info',
              icon: '🛑',
              title: `${shortSessions.length} Very Short Session${shortSessions.length > 1 ? 's' : ''} (Stopped by USER)`,
              description: `Found ${shortSessions.length} session${shortSessions.length > 1 ? 's' : ''} under 30 seconds that ended with stop reason "USER". <strong>What "USER" means:</strong> The stop was logged as a normal user-initiated stop. If the app had crashed or auto-stopped due to errors, we would see different markers (CRASHED, ERROR, CONFIG, or missing stop events).`,
              action: 'If the user disputes stopping manually, this could indicate: accidental click, mouse/trackpad issue, or another person/process interacting with the app. Network errors, CPU usage, or timezone issues do NOT cause USER stop events.',
              techDetail: shortSessions.map(s => `${fmtTime(s.start)} → ${fmtTime(s.stop)} (${Math.round(s.duration)}s)`).join('\n')
            });
          }
        }
        
        // === CRASH INDICATOR CHECK ===
        const hasCrashMarkers = data.errors.some(e => 
          e.msg.toLowerCase().includes('crash') || 
          e.msg.toLowerCase().includes('watchdog') ||
          e.msg.toLowerCase().includes('unclean') ||
          e.msg.toLowerCase().includes('resume_detected')
        );
        const hasResumeEvents = data.tracking.some(e => 
          e.msg.toLowerCase().includes('resume_detected') || 
          e.msg.toLowerCase().includes('resumed')
        );
        
        if (!hasCrashMarkers && !hasResumeEvents && crashedSessions.length === 0) {
          findings.push({
            severity: 'success',
            icon: '✅',
            title: 'No Crash Indicators Found',
            description: 'The logs show no signs of app crashes, force-quits, or unexpected terminations. All sessions have proper START and STOP events. If the app had crashed, we would expect to see: STARTUP_UNCLEAN, RESUME_DETECTED, watchdog hits, or missing STOP events.',
            action: null,

          });
        }
      } else {
        // No sessions found
        findings.push({
          severity: 'warning',
          icon: '⏱️',
          title: 'No Tracking Sessions Found',
          description: `The log spans <strong>${fmtDuration(logDurationSecs)}</strong> but no START_TRACKING/STOP_TRACKING pairs were detected. This could mean: the timer was never started during this period, or the log file doesn't contain the tracking events.`,
          action: 'Check if this is the correct log file for the time period in question.',
          techDetail: null
        });
      }
      
      // === IDLE SUMMARY ===
      if (data.idleKeptSecs > 0 || data.idleDiscardedSecs > 0) {
        const totalIdle = data.idleKeptSecs + data.idleDiscardedSecs;
        findings.push({
          severity: 'info',
          icon: '💤',
          title: `Idle Time: ${fmtDuration(totalIdle)}`,
          description: `User went idle ${data.idleDecisions.length} time(s). Kept ${fmtDuration(data.idleKeptSecs)}, discarded ${fmtDuration(data.idleDiscardedSecs)}.`,
          action: data.idleDiscardedSecs > 0 ? 'Discarded idle time does not count toward tracked hours.' : null,
          techDetail: null
        });
      }

      // === TIMEZONE ===
      if (data.timezone) {
        findings.push({
          severity: 'info',
          icon: '🌍',
          title: `Timezone: UTC${data.timezone}`,
          description: `User's computer timezone offset detected from logs.`,
          action: null,
          techDetail: null
        });
      }

      // === APP VERSION CHECK ===
      // Detect app version and platform from logs
      let appVersion = null;
      let appPlatform = null;
      let buildNumber = null;
      let versionLine = null;
      
      // Search for version patterns in logs
      for (const line of allLines) {
        // iOS: "2.2.72-100174-main-g77190d27" or "Hubstaff/2.2.72"
        if (!appVersion && (line.includes('Hubstaff/') || line.includes('CFBundle') || line.includes('-main-g'))) {
          const iosMatch = line.match(/(\d+\.\d+\.\d+)-(\d+)-main-g([a-f0-9]+)/i) ||
                          line.match(/Hubstaff\/(\d+\.\d+\.\d+)/) ||
                          line.match(/CFBundleShortVersionString[:\s]+(\d+\.\d+\.\d+)/);
          if (iosMatch) {
            appVersion = iosMatch[1];
            if (iosMatch[2]) buildNumber = iosMatch[2];
            appPlatform = 'iOS';
            versionLine = line;
          }
        }
        
        // Android: "2.2.75-63528" or "versionName=2.2.75"
        if (!appVersion && (line.includes('versionName') || line.match(/\d+\.\d+\.\d+-\d{4,}/))) {
          const androidMatch = line.match(/(\d+\.\d+\.\d+)-(\d{4,})/) ||
                               line.match(/versionName[=:\s]+(\d+\.\d+\.\d+)/);
          if (androidMatch) {
            appVersion = androidMatch[1];
            if (androidMatch[2]) buildNumber = androidMatch[2];
            appPlatform = 'Android';
            versionLine = line;
          }
        }
        
        // Windows/Mac/Linux desktop: "Version: 1.6.8" or "Hubstaff Desktop 1.6.8"
        if (!appVersion && (line.includes('Hubstaff Desktop') || line.includes('Desktop Version'))) {
          const desktopMatch = line.match(/(\d+\.\d+\.\d+)/);
          if (desktopMatch) {
            appVersion = desktopMatch[1];
            versionLine = line;
            // Try to detect OS
            if (line.toLowerCase().includes('windows') || allLines.some(l => l.includes('Windows') || l.includes('win32'))) {
              appPlatform = 'Windows';
            } else if (line.toLowerCase().includes('mac') || allLines.some(l => l.includes('macOS') || l.includes('darwin'))) {
              appPlatform = 'Mac';
            } else if (line.toLowerCase().includes('linux') || allLines.some(l => l.includes('Linux') || l.includes('linux'))) {
              appPlatform = 'Linux';
            } else {
              appPlatform = 'Desktop';
            }
          }
        }
        
        // Chrome/Firefox Extension: "Extension Version: 1.5.2"
        if (!appVersion && (line.includes('Extension') && line.includes('Version'))) {
          const extMatch = line.match(/(\d+\.\d+\.\d+)/);
          if (extMatch) {
            appVersion = extMatch[1];
            versionLine = line;
            if (line.toLowerCase().includes('chrome') || allLines.some(l => l.includes('Chrome'))) {
              appPlatform = 'Chrome Extension';
            } else if (line.toLowerCase().includes('firefox') || allLines.some(l => l.includes('Firefox'))) {
              appPlatform = 'Firefox Extension';
            } else {
              appPlatform = 'Browser Extension';
            }
          }
        }
        
        // Chromebook
        if (!appVersion && (line.includes('Chromebook') || line.includes('ChromeOS') || line.includes('CrOS'))) {
          const chromeOsMatch = line.match(/(\d+\.\d+\.\d+)/);
          if (chromeOsMatch) {
            appVersion = chromeOsMatch[1];
            appPlatform = 'Chromebook';
            versionLine = line;
          }
        }
        
        // Web Timer
        if (!appVersion && (line.includes('Web Timer') || line.includes('web-timer'))) {
          const webMatch = line.match(/(\d+\.\d+\.\d+)/);
          if (webMatch) {
            appVersion = webMatch[1];
            appPlatform = 'Web Timer';
            versionLine = line;
          }
        }
        
        // Generic fallback: "App Version: X.X.X" or "Client Version: X.X.X"
        if (!appVersion && (line.includes('App Version') || line.includes('Client Version') || line.includes('APPLICATION_VERSION'))) {
          const genericMatch = line.match(/(\d+\.\d+\.\d+)/);
          if (genericMatch) {
            appVersion = genericMatch[1];
            versionLine = line;
          }
        }
        
        // Stop searching once we found a version
        if (appVersion) break;
      }
      
      // Detect platform from other indicators if not already set
      if (!appPlatform) {
        if (allLines.some(line => line.includes('UIKit') || line.includes('kCLErrorDomain') || line.includes('CoreLocation'))) {
          appPlatform = 'iOS';
        } else if (allLines.some(line => line.includes('android.') || line.match(/manufacturer\s*:/i) || line.includes('Xiaomi') || line.includes('Samsung'))) {
          appPlatform = 'Android';
        } else if (allLines.some(line => line.includes('WindowsInput') || line.includes('win32') || line.includes('Windows'))) {
          appPlatform = 'Windows';
        } else if (allLines.some(line => line.includes('macOS') || line.includes('darwin') || line.includes('NSApplication'))) {
          appPlatform = 'Mac';
        } else if (allLines.some(line => line.includes('Linux') && !line.includes('linux-'))) {
          appPlatform = 'Linux';
        }
      }
      
      // Known problematic versions (update as needed)
      const PROBLEMATIC_VERSIONS = {
        'iOS': {
          '2.2.68': 'Known bug causing locations to temporarily stop uploading.',
          '2.2.65': 'Issues with background location tracking on some devices.',
        },
        'Android': {
          '2.2.68': 'Geofence detection reliability issues.',
        },
        'Windows': {},
        'Mac': {},
        'Linux': {},
      };
      
      if (appVersion) {
        const platformProblems = PROBLEMATIC_VERSIONS[appPlatform] || {};
        const isProblematic = platformProblems[appVersion];
        
        const fullVersionString = buildNumber ? `${appVersion}-${buildNumber}` : appVersion;
        const platformIcon = {
          'iOS': '🍎',
          'Android': '🤖',
          'Windows': '🪟',
          'Mac': '🍎',
          'Linux': '🐧',
          'Chrome Extension': '🌐',
          'Firefox Extension': '🦊',
          'Chromebook': '💻',
          'Web Timer': '🌐',
          'Desktop': '🖥️',
          'Browser Extension': '🔌',
        }[appPlatform] || '📱';
        
        if (isProblematic) {
          findings.push({
            severity: 'critical',
            icon: platformIcon,
            title: `${appPlatform || 'App'} Version: ${fullVersionString} ⚠️ KNOWN ISSUES`,
            description: `<strong>${isProblematic}</strong>`,
            action: `Have the user update to the latest version immediately.`,
            techDetail: versionLine ? versionLine.slice(0, 200) : null
          });
        } else {
          findings.push({
            severity: 'info',
            icon: platformIcon,
            title: `${appPlatform || 'App'} Version: ${fullVersionString}`,
            description: `Detected from logs. <a href="https://app.hubstaff.com/admin/releases" target="_blank" style="color:var(--link);">Check releases page</a> to verify if current.`,
            action: null,
            techDetail: versionLine ? versionLine.slice(0, 200) : null
          });
        }
      } else {
        // No version detected
        findings.push({
          severity: 'info',
          icon: '❓',
          title: 'App Version: Not Detected',
          description: 'Could not find app version in logs. This may be a partial log or the version info was not captured.',
          action: 'Ask the user for their app version from Settings > About, or check the device info in the Admin panel.',
          techDetail: null
        });
      }

      // === iOS PERMISSION STATUS CHECK ===
      const permissionLine = allLines.find(line => line.includes('SESSION:') && line.includes('device_locations='));
      if (permissionLine) {
        const locPermMatch = permissionLine.match(/device_locations=(\w+)/);
        if (locPermMatch) {
          const permStatus = locPermMatch[1];
          if (permStatus === 'undetermined') {
            findings.push({
              severity: 'critical',
              icon: '📍',
              title: 'Location Permission Not Yet Granted',
              description: `iOS location permission is <strong>undetermined</strong> - the user has not yet responded to the location permission prompt or it was never shown.`,
              action: 'User needs to: 1) Open Hubstaff app and approve location prompt if shown, OR 2) Go to iOS Settings → Privacy & Security → Location Services → Hubstaff → select "Always" and enable "Precise Location".',
              techDetail: permissionLine
            });
          } else if (permStatus === 'denied') {
            findings.push({
              severity: 'critical',
              icon: '🚫',
              title: 'Location Permission Denied',
              description: `iOS location permission is <strong>denied</strong>. The app cannot access location at all.`,
              action: 'User must go to iOS Settings → Privacy & Security → Location Services → Hubstaff → select "Always". They may have accidentally denied the prompt.',
              techDetail: permissionLine
            });
          } else if (permStatus === 'restricted') {
            findings.push({
              severity: 'critical',
              icon: '🔒',
              title: 'Location Permission Restricted',
              description: `iOS location permission is <strong>restricted</strong> by device management (MDM) or parental controls.`,
              action: 'Contact the IT administrator who manages this device. They need to allow location access for Hubstaff in the MDM profile.',
              techDetail: permissionLine
            });
          } else if (permStatus === 'authorizedWhenInUse') {
            findings.push({
              severity: 'warning',
              icon: '⚠️',
              title: 'Location Set to "While Using" - Insufficient',
              description: `iOS location permission is set to <strong>"While Using App"</strong>. This is NOT sufficient for background location tracking. Locations will only be recorded while the app is open and on screen.`,
              action: 'User must go to iOS Settings → Hubstaff → Location → change from "While Using the App" to "Always". Background tracking requires "Always" permission.',
              techDetail: permissionLine
            });
          }
        }
      }

      // === iOS LOCATION ERROR CHECK ===
      const locationDeniedError = allLines.find(line => line.includes('kCLErrorDomain Code=1') || (line.includes('[Position]') && line.includes('denied')));
      if (locationDeniedError && !findings.some(f => f.title.includes('Permission Denied'))) {
        findings.push({
          severity: 'critical',
          icon: '🚫',
          title: 'iOS Blocked Location Request',
          description: `Found iOS error <strong>kCLErrorDomain Code=1</strong> which means iOS actively denied a location request. Even if the app has internal consent, iOS is blocking location access.`,
          action: 'This is the smoking gun! User must change iOS location permission: Settings → Privacy & Security → Location Services → Hubstaff → "Always".',
          techDetail: locationDeniedError.slice(0, 200)
        });
      }

      // === PERMISSION MISMATCH CHECK ===
      const appConsentsLocation = allLines.find(line => line.includes('consents') && line.includes('locations') && line.includes('true'));
      const iosLocationDenied = allLines.some(line => line.includes('device_locations=denied') || line.includes('device_locations=undetermined') || (line.includes('kCLErrorDomain') && line.includes('Code=1')));
      
      if (appConsentsLocation && iosLocationDenied) {
        findings.push({
          severity: 'critical',
          icon: '🔀',
          title: 'Permission Mismatch Detected',
          description: `The Hubstaff app has location consent enabled (<code>consents.locations: true</code>), but iOS is blocking location access. The user agreed to tracking in the app but iOS permissions are wrong.`,
          action: 'This explains the issue! The app thinks it has permission but iOS disagrees. Fix: iOS Settings → Privacy & Security → Location Services → Hubstaff → "Always".',
          techDetail: 'App consent: ' + (appConsentsLocation ? appConsentsLocation.slice(0, 100) : 'found')
        });
      }

      // === ANDROID BATTERY OPTIMIZATION CHECK ===
      const batteryOptLine = allLines.find(line => line.includes('isIgnoringBatteryOptimization'));
      if (batteryOptLine) {
        const isIgnoring = batteryOptLine.includes('isIgnoringBatteryOptimization: =true');
        if (!isIgnoring) {
          findings.push({
            severity: 'warning',
            icon: '🔋',
            title: 'Battery Optimization NOT Disabled',
            description: `Android battery optimization is <strong>active</strong> for Hubstaff. This means Android may kill the app in the background to save battery, causing tracking gaps and missed notifications.`,
            action: 'Disable battery optimization: Settings → Apps → Hubstaff → Battery → "Unrestricted". Samsung: Also check Device Care → Battery → App power management.',
            techDetail: batteryOptLine.slice(0, 200)
          });
        }
      }

      // === ANDROID REPEATED CRASH/KILL CHECK ===
      const uncleanCount = allLines.filter(line => line.includes('STARTUP_UNCLEAN')).length;
      if (uncleanCount > 5) {
        findings.push({
          severity: 'critical',
          icon: '💥',
          title: `App Killed/Crashed ${uncleanCount} Times`,
          description: `Found <strong>${uncleanCount}</strong> unclean startup events. The app is being repeatedly killed by Android or crashing. This is very likely caused by aggressive battery optimization.`,
          action: '1) Disable battery optimization for Hubstaff, 2) On Samsung: Check "Sleeping apps" and "Deep sleeping apps" lists - remove Hubstaff, 3) Enable "Autostart" if available on your device.',
          techDetail: `Found ${uncleanCount} STARTUP_UNCLEAN events in logs`
        });
      } else if (uncleanCount > 0) {
        findings.push({
          severity: 'warning',
          icon: '⚠️',
          title: `App Crashed/Force-Closed ${uncleanCount} Time${uncleanCount > 1 ? 's' : ''}`,
          description: `The app detected ${uncleanCount} unclean shutdown${uncleanCount > 1 ? 's' : ''} from previous sessions.`,
          action: 'Check if user is force-closing the app or if battery optimization is killing it in the background.',
          techDetail: null
        });
      }

      // === ANDROID JOB SITE RESTRICTION BLOCK CHECK ===
      const jobSiteBlocks = allLines.filter(line => line.includes('TRACKING_NOT_STARTED') || line.includes('requires being at a job site'));
      if (jobSiteBlocks.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🚫',
          title: `Timer Blocked ${jobSiteBlocks.length} Times - Not At Job Site`,
          description: `User attempted to start the timer <strong>${jobSiteBlocks.length}</strong> time${jobSiteBlocks.length > 1 ? 's' : ''} but was blocked because they are not at a job site. The organization has "Restrict timer to job sites" enabled.`,
          action: 'User must be physically at a configured job site to start tracking. If they ARE at a site: 1) GPS accuracy issue - try going outdoors with clear sky, 2) Job site radius may be too small - increase to 100-150m, 3) Job site pin location may be wrong on the map.',
          techDetail: jobSiteBlocks.slice(0,3).map(l => l.slice(0, 120)).join('\n')
        });
      }

      // === ANDROID DNS/NETWORK FAILURE CHECK ===
      const dnsErrors = allLines.filter(line => line.includes('Could not resolve host') || line.includes('UnknownHostException'));
      if (dnsErrors.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🌐',
          title: `Network/DNS Failures Detected (${dnsErrors.length} errors)`,
          description: `Found <strong>${dnsErrors.length}</strong> DNS resolution failures. The device could not reach Hubstaff servers because there was no working internet connection during these times.`,
          action: 'Check: 1) WiFi or mobile data is ON, 2) Airplane mode is OFF, 3) Try switching between WiFi and cellular, 4) Restart the device. Data cannot sync without internet.',
          techDetail: dnsErrors.slice(0,2).map(l => l.slice(0, 100)).join('\n')
        });
      }

      // === ANDROID DEVICE DETECTION ===
      const deviceLine = allLines.find(line => line.includes('device manufacturer'));
      if (deviceLine) {
        const mfgMatch = deviceLine.match(/manufacturer\s*:\s*(\w+)/i);
        const modelMatch = deviceLine.match(/model:\s*([\w-]+)/i);
        const osMatch = deviceLine.match(/OS:\s*(\d+)/i);
        
        if (mfgMatch || modelMatch) {
          const manufacturer = mfgMatch ? mfgMatch[1] : 'Unknown';
          const model = modelMatch ? modelMatch[1] : 'Unknown';
          const osVersion = osMatch ? osMatch[1] : 'Unknown';
          
          let deviceWarning = null;
          // Brand-specific battery warnings
          if (manufacturer.toLowerCase() === 'samsung') {
            deviceWarning = 'Samsung devices have aggressive battery optimization. Ensure Hubstaff is set to "Unrestricted" and NOT in "Sleeping apps" or "Deep sleeping apps" lists.';
          } else if (manufacturer.toLowerCase() === 'xiaomi' || manufacturer.toLowerCase() === 'redmi') {
            deviceWarning = 'Xiaomi/MIUI has very aggressive battery management. Enable "Autostart" for Hubstaff and disable all battery restrictions.';
          } else if (manufacturer.toLowerCase() === 'huawei') {
            deviceWarning = 'Huawei restricts background apps heavily. Add Hubstaff to "Protected Apps" and disable power-saving for it.';
          } else if (manufacturer.toLowerCase() === 'oppo' || manufacturer.toLowerCase() === 'realme') {
            deviceWarning = 'OPPO/Realme has aggressive app killing. Enable "Allow Auto-start" and disable battery optimization for Hubstaff.';
          } else if (manufacturer.toLowerCase() === 'oneplus') {
            deviceWarning = 'OnePlus: Settings → Battery → Battery Optimization → Hubstaff → Don\'t optimize.';
          }
          
          findings.push({
            severity: deviceWarning ? 'info' : 'info',
            icon: '📱',
            title: `Android Device: ${manufacturer} ${model} (API ${osVersion})`,
            description: `Detected Android device from logs.`,
            action: deviceWarning,

          });
        }
      }

      // === INJECTED INPUT ===
      if (data.injected.length > 0) {
        const onlyInjected = data.injected.filter(e => e.onlyInjected === true || e.msg.toLowerCase().includes('only injected'));
        const simulated = data.injected.filter(e => e.inputType === 'simulated' || e.msg.toLowerCase().includes('simulating missed input'));
        const regularInjected = data.injected.filter(e => e.inputType === 'injected' && !e.onlyInjected);
        
        // Separate findings for simulated vs injected
        if (simulated.length > 0) {
          findings.push({
            severity: simulated.length > 50 ? 'warning' : 'info',
            icon: '🔌',
            title: `Simulated Input: ${simulated.length} Events`,
            description: `Detected ${simulated.length} "Simulating missed input" event${simulated.length > 1 ? 's' : ''}. <strong>This means Hubstaff detected activity but couldn't identify the source device.</strong> This typically indicates a hardware recognition issue, not cheating.`,
            action: simulated.length > 50 ? 
              '<strong>Likely hardware issue causing high activity.</strong> Ask the user to: 1) List ALL connected devices (drawing tablets, stylus pens, touchscreens, KVM switches, USB hubs), 2) Disconnect all except mouse/keyboard, 3) Monitor activity for 10 mins, 4) Reconnect devices one-by-one to isolate the problem device.' :
              'Some simulated input detected. If activity rates seem unusually high, check for drawing tablets, touchscreens, or unusual peripherals.',
            techDetail: `Common causes: Drawing tablets (Wacom, XP-Pen), stylus/touchscreens, KVM switches, USB hubs, non-standard mice.\n\nSample events:\n` + simulated.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,80)}`).join('\n')
          });
        }
        
        if (onlyInjected.length > 0 || regularInjected.length > 0) {
          const injectedTotal = onlyInjected.length + regularInjected.length;
          let desc = `Detected ${injectedTotal} injected input event${injectedTotal > 1 ? 's' : ''}.`;
          if (onlyInjected.length > 0) desc += ` <strong>${onlyInjected.length} showed ONLY injected input (no real input alongside)</strong> - this is more suspicious.`;
          
          findings.push({
            severity: onlyInjected.length > 10 ? 'warning' : 'info',
            icon: '🤖',
            title: `Injected Input: ${injectedTotal} Events`,
            description: desc + ` <strong>Common legitimate causes:</strong> Remote desktop, accessibility tools, automation software, gaming peripherals with macros.`,
            action: onlyInjected.length > 10 ? 
              'High number of "only injected" events. Check if user is using remote desktop or automation tools. Review screenshots for repeated patterns.' : 
              'Some injected input detected. This is often normal - check the Injected Input section for details.',
            techDetail: data.injected.filter(e => e.inputType === 'injected').slice(0,5).map(e => `${fmtTime(e.ts)}: ${e.inputDetail || e.msg.slice(0,80)}`).join('\n')
          });
        }
      }
      
      // Check for critical issues
      // === iOS/LOCATION SPECIFIC ISSUES ===
      const nonPrimaryIssues = data.locations.filter(e => e.msg.toLowerCase().includes('not primary') || e.msg.toLowerCase().includes('non-primary'));
      const locationUnavailable = data.locations.filter(e => e.msg.toLowerCase().includes('unavailable') || e.msg.toLowerCase().includes('denied'));
      const mustVisitSite = data.locations.filter(e => e.msg.toLowerCase().includes('must visit'));
      const simulatedLocations = data.locations.filter(e => e.msg.toLowerCase().includes('simulated location'));
      const siteEnters = data.locations.filter(e => e.msg.includes('ENTER'));
      const siteExits = data.locations.filter(e => e.msg.includes('EXIT'));
      const autoStartEvents = data.locations.filter(e => e.msg.toLowerCase().includes('auto-start'));
      const autoStopEvents = data.locations.filter(e => e.msg.toLowerCase().includes('auto-stop'));
      
      if (nonPrimaryIssues.length > 0) {
        findings.push({
          severity: 'warning', icon: '📱', title: 'Non-Primary Device Issues',
          description: `Found ${nonPrimaryIssues.length} event${nonPrimaryIssues.length > 1 ? 's' : ''} where actions were blocked because this isn't the primary device. <strong>Only the primary device can record locations and trigger job site automations.</strong>`,
          action: 'Have the user tap the "Make Primary" banner on the Timer screen, or check which device is primary in Admin → User → Primary Device.',
          techDetail: nonPrimaryIssues.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      if (locationUnavailable.length > 0) {
        findings.push({
          severity: 'critical', icon: '📍', title: 'Location Unavailable',
          description: `Found ${locationUnavailable.length} event${locationUnavailable.length > 1 ? 's' : ''} where location was unavailable. This prevents job site features and may block tracking if "Restrict timer to job sites" is enabled.`,
          action: '<strong>iOS:</strong> Settings → Privacy & Security → Location Services → ON, then Settings → Hubstaff → Location → Always + Precise Location ON. <strong>Android:</strong> Enable location permission with "Allow all the time" + High Accuracy mode.',
          techDetail: locationUnavailable.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      if (mustVisitSite.length > 0) {
        findings.push({
          severity: 'critical', icon: '🚫', title: 'Timer Blocked - Not At Job Site',
          description: `Found ${mustVisitSite.length} attempt${mustVisitSite.length > 1 ? 's' : ''} to start the timer that were blocked because the user wasn't at a job site. The organization has "Restrict timer to job sites" enabled.`,
          action: 'User must be physically at a configured job site to start tracking. If they ARE at the site, this could be a GPS accuracy issue - consider increasing the job site radius to 100-150m.',
          techDetail: mustVisitSite.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      if (simulatedLocations.length > 0) {
        findings.push({
          severity: 'critical', icon: '🚫', title: 'Fake/Simulated Locations Detected',
          description: `Found ${simulatedLocations.length} simulated (fake) location${simulatedLocations.length > 1 ? 's' : ''} that were blocked. The user may be using a GPS spoofing app.`,
          action: 'Hubstaff blocks fake locations. If legitimate, user may have a developer/mock location app enabled that needs to be disabled.',
          techDetail: simulatedLocations.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      if (siteEnters.length > 0 || siteExits.length > 0) {
        let siteDesc = '';
        if (siteEnters.length > 0) siteDesc += `${siteEnters.length} site entry event${siteEnters.length > 1 ? 's' : ''}`;
        if (siteEnters.length > 0 && siteExits.length > 0) siteDesc += ' and ';
        if (siteExits.length > 0) siteDesc += `${siteExits.length} site exit event${siteExits.length > 1 ? 's' : ''}`;
        const autoActions = autoStartEvents.length + autoStopEvents.length;
        if (autoActions > 0) siteDesc += `. ${autoActions} automation action${autoActions > 1 ? 's' : ''} triggered.`;
        findings.push({ severity: 'success', icon: '📍', title: 'Job Site Activity Detected', description: siteDesc, action: null, techDetail: null });
      }
      const watchdogHits = data.errors.filter(e => e.msg.toLowerCase().includes('watchdog'));
      if (watchdogHits.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🥶',
          title: `App Froze ${watchdogHits.length} Time${watchdogHits.length > 1 ? 's' : ''}`,
          description: 'The Hubstaff app became unresponsive and had to recover. This can cause gaps in tracking.',
          action: 'Ask the user if the app felt slow or frozen. They may need to restart Hubstaff or their computer.',
          techDetail: watchdogHits.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      const helperCrashes = data.errors.filter(e => e.msg.toLowerCase().includes('helper died') || e.msg.toLowerCase().includes('helper crash'));
      if (helperCrashes.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🔌',
          title: 'Browser Extension Crashed',
          description: 'The Hubstaff browser extension stopped working. This affects URL and app tracking.',
          action: 'Have the user reinstall the browser extension and restart their browser.',
          techDetail: helperCrashes.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      const serverErrors = data.network.filter(e => e.msg.match(/response:\s*5\d{2}/i));
      if (serverErrors.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🌐',
          title: `${serverErrors.length} Server Error${serverErrors.length > 1 ? 's' : ''} Detected`,
          description: 'Hubstaff servers returned errors. This may have prevented data from uploading.',
          action: 'Check status.hubstaff.com for any reported outages during this time period.',
          techDetail: serverErrors.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      const authErrors = data.network.filter(e => e.msg.match(/response:\s*(401|403)/i));
      if (authErrors.length > 0) {
        findings.push({
          severity: 'critical',
          icon: '🔐',
          title: 'Authentication Problems',
          description: 'The user\'s login session may have expired or their permissions changed.',
          action: 'Have the user log out of Hubstaff completely and log back in.',
          techDetail: authErrors.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      const discards = data.warnings.filter(e => e.msg.toLowerCase().includes('discard='));
      if (discards.length > 0) {
        const lockedDiscards = discards.filter(e => e.msg.toLowerCase().includes('locked'));
        const futureDiscards = discards.filter(e => e.msg.toLowerCase().includes('future'));
        
        if (lockedDiscards.length > 0) {
          findings.push({
            severity: 'critical',
            icon: '🔒',
            title: 'Time Rejected - Timesheet Locked',
            description: 'Some tracked time was rejected because the timesheet was already approved/locked.',
            action: 'An admin needs to unlock the timesheet, or time must be added to a different date.',
            techDetail: lockedDiscards.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
          });
        }
        if (futureDiscards.length > 0) {
          findings.push({
            severity: 'critical',
            icon: '⏰',
            title: 'Time Rejected - Clock Problem',
            description: 'Time was rejected because the computer\'s clock was set incorrectly (in the future).',
            action: 'Have the user check their system date/time settings and enable automatic time.',
            techDetail: futureDiscards.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
          });
        }
      }
      
      const memoryIssues = data.warnings.filter(e => e.msg.toLowerCase().includes('memory'));
      if (memoryIssues.length > 0) {
        findings.push({
          severity: 'warning',
          icon: '💾',
          title: 'Low Memory Warnings',
          description: 'The computer was running low on memory (RAM), which can slow down Hubstaff.',
          action: 'Suggest the user close unused programs or browser tabs.',
          techDetail: memoryIssues.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }
      
      const locationDenied = data.locations.filter(e => e.msg.toLowerCase().includes('denied') || e.msg.toLowerCase().includes('restricted'));
      if (locationDenied.length > 0) {
        findings.push({
          severity: 'warning',
          icon: '📍',
          title: 'Location Permission Issues',
          description: 'Location permissions were denied. Job Sites features won\'t work properly.',
          action: 'Have the user enable "Always" location permission for Hubstaff in their device settings.',
          techDetail: locationDenied.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.msg.slice(0,100)}`).join('\n')
        });
      }

      // === BRAVE BROWSER CHECK ===
const braveUsage = data.apps.filter(e => 
  (e.extractedApp && e.extractedApp.toLowerCase().includes('brave')) ||
  (e.raw && e.raw.toLowerCase().includes('brave')) ||
  (e.msg && e.msg.toLowerCase().includes('brave'))
);

// Also check all lines for Brave in PutApplications blocks
const braveInLogs = allLines.some(line => 
  line.includes('name') && line.toLowerCase().includes('brave')
);
      if (braveUsage.length > 0 || braveInLogs) {
  findings.push({
    severity: 'warning',
    icon: '🦁',
    title: 'Brave Browser Detected - URL Tracking Not Supported',
    description: `Brave Browser usage detected in logs. <strong>Hubstaff does not support URL tracking in Brave Browser.</strong> The app name will be tracked, but visited URLs will not appear in reports.`,
    action: 'For URL tracking on Windows, the user should switch to a supported browser: Google Chrome, Microsoft Edge, Firefox, or Island Browser.',
    techDetail: braveUsage.length > 0 ? braveUsage.slice(0,3).map(e => `${fmtTime(e.ts)}: ${e.extractedApp || 'Brave Browser'}`).join('\n') : 'Detected in PutApplications block'
  });
}
      
      // Positive findings — screenshots
      if (data.screenshots.length > 0) {
        const sh = data.screenshotHealth;
        const hasExplicitFail = data.screenshots.some(e => e.msg.toLowerCase().includes('fail') || e.msg.toLowerCase().includes('error'));
        
        if (hasExplicitFail) {
          findings.push({
            severity: 'critical',
            icon: '📸',
            title: 'Screenshot Capture/Upload Failures',
            description: 'Explicit screenshot errors found in the logs. Some screenshots may be missing from the dashboard.',
            action: 'Check screen capture permissions and internet connection. On macOS: System Settings → Privacy & Security → Screen Recording → toggle Hubstaff ON.',
            techDetail: sh.failures.slice(0, 3).map(f => `${fmtTime(f.ts)}: ${f.msg}`).join('\n')
          });
        } else if (sh.blankRiskFactors.length > 0) {
          const hasCritical = sh.blankRiskFactors.some(r => r.severity === 'critical');
          const reasons = sh.blankRiskFactors.map(r => r.reason).join(', ');
          findings.push({
            severity: hasCritical ? 'critical' : 'warning',
            icon: '📸',
            title: `${data.screenshots.length} Screenshots Uploading — But May Be Blank`,
            description: `The logs show screenshot events occurring, but ${sh.blankRiskFactors.length} risk factor(s) suggest the actual images may be blank or black: <strong>${reasons}</strong>. Check the Activity page in the Hubstaff dashboard to verify.`,
            action: 'Verify screenshots on the dashboard Activity page. If blank: on macOS, check Screen Recording permission (System Settings → Privacy & Security). On Windows, check for McAfee, Norton, Webroot, or VirtualBox interference. See the Screenshots section below for full details.',
            techDetail: sh.blankRiskFactors.map(r => `${r.severity.toUpperCase()}: ${r.reason} — ${r.detail}`).join('\n')
          });
        } else {
          findings.push({
            severity: 'success',
            icon: '📸',
            title: `${data.screenshots.length} Screenshots Captured`,
            description: 'Screenshots were captured and uploaded successfully during this period. No blank screenshot risk factors detected.',
            action: null,
            techDetail: null
          });
        }
      }
      
      if (findings.length === 0) {
        findings.push({
          severity: 'success',
          icon: '✅',
          title: 'No Major Issues Detected',
          description: 'The logs look healthy. No critical errors or warnings were found.',
          action: 'If the user is still experiencing issues, ask for more specific details about what\'s happening.',
          techDetail: null
        });
      }
      
      return findings;
    }

