    function hideInfoBox() {
      $('infoBox').style.display = 'none';
      if (selectedMarker) { selectedMarker.style.outline = 'none'; selectedMarker = null; }
    }

    function showInfoBox(e, title, content) {
      const box = $('infoBox');
      $('infoTitle').textContent = title;
      $('infoContent').innerHTML = content;
      box.style.display = 'block';

      const rect = box.getBoundingClientRect();
      // Use pageX/pageY to account for scroll position
      let top = e.pageY - rect.height - 15;
      let left = e.pageX - rect.width / 2;
      
      // Keep within viewport bounds (using scroll-adjusted values)
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      if (top < scrollTop + 10) top = e.pageY + 15;
      if (left < scrollLeft + 10) left = scrollLeft + 10;
      if (left + rect.width > scrollLeft + window.innerWidth - 10) {
        left = scrollLeft + window.innerWidth - rect.width - 10;
      }

      box.style.top = top + 'px';
      box.style.left = left + 'px';
    }

    function renderTimeline(data) {
      if (!data || !data.startTime || !data.endTime) {
        $('timelineSection').style.display = 'none';
        return;
      }

      const min = new Date(data.startTime.getTime() - 60000);
      const max = new Date(data.endTime.getTime() + 60000);
      timelineMin = min;
      timelineDur = max - min;

      const pos = ts => ts ? ((ts - min) / timelineDur) * 100 : 0;

      function renderMarkers(items, trackId, cls) {
        const track = $(trackId);
        if (!items.length) { track.innerHTML = ''; return; }
        
        track.innerHTML = items.map((item, i) => {
          const left = pos(item.ts);
          return `<div class="t-marker ${cls}" data-idx="${i}" data-type="${cls}" style="left:${left}%"></div>`;
        }).join('');

        track.querySelectorAll('.t-marker').forEach((el, i) => {
          el.addEventListener('click', e => {
            e.stopPropagation();
            hideInfoBox();
            selectedMarker = el;
            el.style.outline = '2px solid #fff';

            const item = items[i];
            const plainMode = $('plainMode').checked;
            const translation = plainMode ? translateToPlainEnglish(item.msg, item.level, item.src) : null;
            
            let content = `<p><span class="label">Time:</span> ${fmtDate(item.ts)}</p>`;
            if (translation) {
              content += `<p style="color:var(--accent);margin:8px 0;">${translation.text}</p>`;
              if (translation.action) {
                content += `<p style="font-size:11px;color:var(--success);">💡 ${translation.action}</p>`;
              }
            }
            content += `<p><span class="label">Level:</span> ${item.level}</p>`;
            content += `<p><span class="label">Source:</span> ${escapeHtml(item.src || 'N/A')}</p>`;
            content += `<div class="msg">${escapeHtml(item.msg.slice(0, 300))}</div>`;
            
            const titleText = translation ? translation.text.replace(/^[^\s]+\s/, '') : cls.charAt(0).toUpperCase() + cls.slice(1) + ' Event';
            showInfoBox(e, titleText.slice(0, 40), content);
          });
        });
      }

      renderMarkers(data.errors, 'trackErrors', 'error');
      renderMarkers(data.warnings, 'trackWarnings', 'warn');
      renderMarkers(data.screenshots, 'trackScreenshots', 'screenshot');
      renderMarkers(data.network, 'trackNetwork', 'network');
      renderMarkers(data.locations, 'trackLocation', 'location');
      renderMarkers(data.tracking, 'trackTracking', 'tracking');

      $('tlErrorCount').textContent = data.errors.length;
      $('tlWarnCount').textContent = data.warnings.length;
      $('tlScreenCount').textContent = data.screenshots.length;
      $('tlNetCount').textContent = data.network.length;
      $('tlLocCount').textContent = data.locations.length;
      $('tlTrackCount').textContent = data.tracking.length;

      // Time axis
      const axisPoints = 7;
      let axisHtml = '';
      for (let i = 0; i < axisPoints; i++) {
        const t = new Date(min.getTime() + (timelineDur * i / (axisPoints - 1)));
        axisHtml += `<span>${t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>`;
      }
      $('timeAxis').innerHTML = axisHtml;

      $('timelineSection').style.display = 'block';
    }

    function analyze(text) {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      allLines = lines;

      const data = {
        total: lines.length,
        errors: [],
        warnings: [],
        screenshots: [],
        network: [],
        networkBlocks: {       // Aggregated network block analysis
          failedUrls: [],      // {ts, url, errorType, detail}
          blockedDomains: {},  // { domain: { count, endpoints: Set, errorTypes: Set, firstSeen, lastSeen } }
        },
        locations: [],
        apps: [],
        tracking: [],
        injected: [],
        sessions: [],
        authenticatedUsers: [], // {email, userId, firstSeen, lastSeen, authCount}
        idleDecisions: [],
        idleKeptSecs: 0,
        idleDiscardedSecs: 0,
        timezone: null,
        startTime: null,
        endTime: null,
        jobSites: [],
        userLocations: [],
        currentlyEnteredSites: [],
        geofenceEvents: [],
        // Silent App data
        silentApp: {
          detected: false,
          version: null,
          startups: [],       // {ts, type: 'CLEAN'|'UNCLEAN'}
          shutdowns: [],      // {ts, reason}
          authEvents: [],     // {ts, type: 'TOKEN'|'OFFLINE'|'PROVISION_FAIL', user, userId}
          authenticatedUsers: [], // {email, userId, firstSeen, lastSeen, authCount}
          resumes: [],        // {ts, type: 'IGNORED'|'NEEDS_CONFIRM'|'TRACKING', duration, startTime}
          captureDesktop: [], // {ts} - "No monitors detected"
          helperDied: 0,
          helperDiedEvents: [], // {ts} - individual helper died timestamps for trend
          stopErrors: [],     // {ts, msg}
          systemMem: null,    // parsed from Client MEM line
          systemMemSnapshots: [], // all Client MEM readings for trend
          corporateUser: null,
          enterpriseProfile: null,
          // Phase 3
          resumeThreshold: null, // {keep, discard} from config
          autoStartStops: [],    // {ts, type: 'START'|'STOP'|'NO_ACTIVITY', detail}
          doubleStarts: [],      // {ts} - START without prior STOP
          // Phase 4
          sslErrors: [],         // {ts, msg, url, domain}
          http429s: [],          // {ts, msg}
          pendingDetected: [],   // {ts}
          networkBlocks: {       // Aggregated network block analysis
            failedUrls: [],      // {ts, url, errorType, detail}
            blockedDomains: {},  // { domain: { count, endpoints: Set, errorTypes: Set, firstSeen, lastSeen } }
          }
        },
        // Screenshot Health Analysis
        screenshotHealth: {
          captures: [],          // {ts} - "Capture Screen" events
          uploads: [],           // {ts, msg} - "Uploading Screen" events
          writeEvents: [],       // {ts, msg} - "Wrote ScreenData" events
          failures: [],          // {ts, msg} - explicit screenshot failures
          sleepDuringTracking: [], // {ts} - screen sleep while tracker active
          helperCrashNearCapture: 0, // helper crashes within 60s of a capture
          blankRiskFactors: [],  // {reason, detail, severity} - reasons screenshots may be blank
          securitySoftware: [],  // {ts, name} - detected security/antivirus software
          permissionIssues: []   // {ts, msg} - screen recording permission issues
        }
      };

      const showDebug = $('showDebug').checked;
      const showTrace = $('showTrace').checked;
      
      let openSession = null;
      let lastIdleWakeSecs = null;
      let lastIdleWakeTime = null;

      for (const line of lines) {
        const ts = parseTimestamp(line);
        const level = parseLevel(line);
        const src = parseSource(line);
        const msg = parseMessage(line);

        if (ts) {
          if (!data.startTime || ts < data.startTime) data.startTime = ts;
          if (!data.endTime || ts > data.endTime) data.endTime = ts;
        }

        // Extract timezone from first line that has one
        if (!data.timezone) {
          const tz = parseTimezone(line);
          if (tz) data.timezone = tz;
        }
        
        // Also check for TZ Offset line specifically (higher priority)
        if (line.includes('TZ Offset')) {
          const tz = parseTimezone(line);
          if (tz) {
            data.timezone = tz;
            // Auto-fill timezone input if empty
            if (!$('tzOffset').value) {
              $('tzOffset').value = tz;
              updateTzLabel();
            }
          }
        }

        // Skip DEBUG/TRACE unless enabled, BUT always process ApplicationGrabber URL/APP lines
const isAppGrabberUrl = line.includes('ApplicationGrabber') && line.includes('URL:');
const isAppActivity = line.includes('Switched to app') || line.includes('for App :') || (line.includes('WindowsGrabber') && line.includes('name:'));
const isPutApplications = line.includes('PutApplications');
if (!showDebug && level === 'DEBUG' && !isAppGrabberUrl && !isAppActivity && !isPutApplications) continue;
if (!showTrace && level === 'TRACE') continue;

        const entry = { ts, level, src, msg, raw: line };

        // === AUTHENTICATED USERS ===
        if (line.includes('AUTH_TOKEN') && line.includes('via token:')) {
          const authMatch = line.match(/via token:\s*(.+?)(?:\s*\|\|\s*(\d+))?[\r\n]*$/);
          if (authMatch) {
            const email = authMatch[1] ? authMatch[1].trim() : null;
            const userId = authMatch[2] ? authMatch[2].trim() : null;
            if (email || userId) {
              const existing = data.authenticatedUsers.find(u => (userId && u.userId === userId) || (email && u.email === email));
              if (existing) {
                existing.lastSeen = ts;
                existing.authCount++;
                if (userId && !existing.userId) existing.userId = userId;
                if (email && !existing.email) existing.email = email;
              } else {
                data.authenticatedUsers.push({ email, userId, firstSeen: ts, lastSeen: ts, authCount: 1 });
              }
            }
          }
        }

        // === SESSION TRACKING (START/STOP) ===
        if (line.includes('START_TRACKING') || line.includes('Tracking Started')) {
          let reason = 'USER';
          if (line.includes('[RESUMED]') || line.toLowerCase().includes('resumed')) reason = 'RESUMED';
          else if (line.includes('[IDLE]')) reason = 'IDLE';
          
          if (openSession) {
            // Unclosed session - mark as crashed
            openSession.stop = ts;
            openSession.stopReason = 'CRASHED';
            openSession.duration = (openSession.stop - openSession.start) / 1000;
            data.sessions.push(openSession);
          }
          openSession = { start: ts, startReason: reason, stop: null, stopReason: null, duration: 0 };
        }
        
        if (line.includes('STOP_TRACKING') || line.includes('Tracking Stopped')) {
          let reason = 'USER';
          if (line.includes('[IDLE]')) reason = 'IDLE';
          else if (line.includes('[CONFIGURATION]')) reason = 'CONFIG';
          else if (line.includes('[PROJECT_CONFIGURATION_LOCATION]')) reason = 'LEFT_JOBSITE';
          else if (line.includes('[SHUTDOWN]')) reason = 'SHUTDOWN';
          
          if (openSession) {
            openSession.stop = ts;
            openSession.stopReason = reason;
            openSession.duration = (openSession.stop - openSession.start) / 1000;
            data.sessions.push(openSession);
            openSession = null;
          }
        }

        // === IDLE TRACKING ===
        // Capture IDLE_WAKE seconds
        if (line.includes('IDLE_WAKE') || (line.includes('Idle') && line.includes('wake'))) {
          const secsMatch = line.match(/(?:after|for)\s+(\d+)\s+seconds?/i);
          if (secsMatch) {
            lastIdleWakeSecs = parseInt(secsMatch[1]);
            lastIdleWakeTime = ts;
          }
        }
        
        // Capture idle decisions (KeepIdle / StopTracking)
        if (line.includes('KeepIdle') && line.includes('StopTracking')) {
          const keepMatch = line.match(/KeepIdle[:\s]+(\d+)/i);
          const stopMatch = line.match(/StopTracking[:\s]+(\d+)/i);
          const responseTimeMatch = line.match(/after\s+(\d+)\s+seconds?\s+with/i);
          
          const keepIdle = keepMatch ? keepMatch[1] === '1' : false;
          const stopTracking = stopMatch ? stopMatch[1] === '1' : false;
          const responseTimeSecs = responseTimeMatch ? parseInt(responseTimeMatch[1]) : null;
          
          const idleSecs = lastIdleWakeSecs || 0;
          const exceeds1Hour = idleSecs > 3600;
          
          // Determine the decision type
          // KeepIdle: 1 / StopTracking: 0 = User chose to KEEP idle time
          // KeepIdle: 0 / StopTracking: 1 = User chose to DISCARD and STOP tracking
          // KeepIdle: 0 / StopTracking: 0 = User chose to DISCARD idle but CONTINUE tracking
          let decision, decisionDetail;
          if (keepIdle) {
            decision = 'KEPT';
            decisionDetail = 'User clicked YES to keep idle time';
          } else if (stopTracking) {
            decision = 'DISCARDED_STOPPED';
            decisionDetail = 'User clicked NO and stopped tracking';
          } else {
            decision = 'DISCARDED_CONTINUED';
            decisionDetail = 'User clicked NO but continued tracking';
          }
          
          data.idleDecisions.push({
            ts: ts,
            seconds: idleSecs,
            decision: decision,
            decisionDetail: decisionDetail,
            keepIdle: keepIdle,
            stopTracking: stopTracking,
            responseTimeSecs: responseTimeSecs,
            exceeds1Hour: exceeds1Hour,
            rawValues: `KeepIdle: ${keepIdle ? '1' : '0'} / StopTracking: ${stopTracking ? '1' : '0'}`
          });
          
          if (keepIdle) {
            data.idleKeptSecs += idleSecs;
          } else {
            data.idleDiscardedSecs += idleSecs;
          }
          
          lastIdleWakeSecs = null;
        }

        // Errors
        if (level === 'ERROR' || line.includes('main_watchdog hit') || line.includes('Helper died') || line.includes('crash') || line.includes('FATAL')) {
          data.errors.push(entry);
        }

        // Warnings
        if (level === 'WARN' || line.includes('Discard=') || line.includes('OS Memory') || line.includes('Server Error') || line.includes('traffic issue')) {
          data.warnings.push(entry);
        }

        // Screenshots
        if (line.includes('Uploading Screen') || line.includes('Capture Screen') || line.includes('ScreenData') || line.includes('screenshot') || line.includes('Screenshot')) {
          data.screenshots.push(entry);
          // Detailed screenshot health tracking
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('capture screen')) {
            data.screenshotHealth.captures.push({ ts, msg });
          }
          if (lowerLine.includes('uploading screen')) {
            data.screenshotHealth.uploads.push({ ts, msg });
          }
          if (lowerLine.includes('wrote screendata') || lowerLine.includes('screendata')) {
            data.screenshotHealth.writeEvents.push({ ts, msg });
          }
          if ((lowerLine.includes('screenshot') || lowerLine.includes('screen')) && (lowerLine.includes('fail') || lowerLine.includes('error') || lowerLine.includes('denied') || lowerLine.includes('permission'))) {
            data.screenshotHealth.failures.push({ ts, msg });
          }
        }

        // Detect security/antivirus software that can cause blank screenshots
        if (line.match(/mcafee|norton|webroot|avast|avg |bitdefender|kaspersky|sophos|malwarebytes|eset |trend micro|crowdstrike|sentinel|virtualbox|vmware|webshield|web.shield|firewall/i)) {
          const swMatch = line.match(/(McAfee|Norton|Webroot|Avast|AVG|Bitdefender|Kaspersky|Sophos|Malwarebytes|ESET|Trend Micro|CrowdStrike|SentinelOne|VirtualBox|VMware|WebShield|Firewall)/i);
          if (swMatch) {
            data.screenshotHealth.securitySoftware.push({ ts, name: swMatch[1] });
          }
        }

        // Detect screen recording permission issues (macOS)
        if (line.match(/screen.?recording.?permission|screen.?capture.?permission|kTCCService|tcc.*screen|CGWindowList.*error|screen.?recording.*denied|cannot.?capture|capture.*denied|accessibility.*denied/i)) {
          data.screenshotHealth.permissionIssues.push({ ts, msg });
        }

        // Network
        if (line.match(/Response:\s*[45]\d{2}/) || line.includes('Server Error') || line.includes('Network') || line.includes('CURL') || line.includes('traffic issue')) {
          data.network.push(entry);
        }

        // Network block URL extraction (works for all log types)
        var urlTagMatch2 = line.match(/\[Exception::tag_http_request_url\*\]\s*=\s*(https?:\/\/[^\s\r\n]+)/);
        if (urlTagMatch2) {
          var url2 = urlTagMatch2[1].trim();
          try {
            var hostname2 = new URL(url2).hostname;
            var endpoint2 = new URL(url2).pathname.replace(/\/[a-f0-9]{20,}[^\s\/]*/g, '/*').replace(/\/\d{4}\/\d{2}\/\d+\/[^\/]+\/[^\/]+$/, '/…');
            var errorType2 = 'network';
            if (line.includes('SSL') || line.includes('ssl')) errorType2 = 'ssl';
            else if (line.includes('Timeout') || line.includes('timeout')) errorType2 = 'timeout';
            data.networkBlocks.failedUrls.push({ ts, url: url2, errorType: errorType2, domain: hostname2, endpoint: endpoint2 });
            if (!data.networkBlocks.blockedDomains[hostname2]) {
              data.networkBlocks.blockedDomains[hostname2] = { count: 0, endpoints: new Set(), errorTypes: new Set(), firstSeen: ts, lastSeen: ts };
            }
            var dom2 = data.networkBlocks.blockedDomains[hostname2];
            dom2.count++;
            dom2.endpoints.add(endpoint2);
            dom2.errorTypes.add(errorType2);
            if (ts) dom2.lastSeen = ts;
          } catch(e) {}
        }
        var connMatch2 = line.match(/connection to ([a-zA-Z0-9._-]+\.(?:com|net|org|io|amazonaws\.com)):(\d+)/);
        if (connMatch2) {
          var hostname3 = connMatch2[1];
          if (!data.networkBlocks.blockedDomains[hostname3]) {
            data.networkBlocks.blockedDomains[hostname3] = { count: 0, endpoints: new Set(), errorTypes: new Set(), firstSeen: ts, lastSeen: ts };
          }
          data.networkBlocks.blockedDomains[hostname3].count++;
          data.networkBlocks.blockedDomains[hostname3].errorTypes.add('ssl');
        }

        // Locations (expanded for iOS/Android location issues)
        if (line.includes('feed: sites') || line.includes('LocationFeatureState') || line.includes('LocationManager') || line.includes('geofence') || line.includes('Geofence') || line.includes('Job Site') || line.includes('[Site]') || line.includes('[Position]') || line.includes('[LocationRequest]') || line.includes('[LocationResolution]') || line.includes('primary device') || line.includes('Primary changed') || (line.toLowerCase().includes('location') && (line.includes('permission') || line.includes('unavailable') || line.includes('denied')))) {
          data.locations.push(entry);
        }

        // Apps & URLs - improved to handle multi-line URL/TITLE format
// Check if it's an ApplicationGrabber line with actual URL content
if (line.includes('ApplicationGrabber') && line.includes('URL:')) {
  const urlMatch = line.match(/URL:\s*(\S+)/);
  if (urlMatch && urlMatch[1]) {
    entry.extractedUrl = urlMatch[1];
    entry.extractedType = 'URL';
    data.apps.push(entry);
  }
}
// Skip standalone "TITLE:" lines that are empty or only whitespace
else if (line.match(/^TITLE:\s*$/) || line.match(/^\s*TITLE:\s*$/)) {
  // Skip empty TITLE lines - these are noise
}
// Capture TITLE lines that actually have content
else if (line.includes('TITLE:') && line.match(/TITLE:\s*\S+/)) {
  const titleMatch = line.match(/TITLE:\s*(.+)/);
  if (titleMatch && titleMatch[1].trim()) {
    entry.extractedTitle = titleMatch[1].trim();
    entry.extractedType = 'Title';
    data.apps.push(entry);
  }
}
// APP: lines (explicit format)
else if (line.includes('APP:')) {
  const appMatch = line.match(/APP:\s*(.+)/);
  if (appMatch && appMatch[1].trim()) {
    entry.extractedApp = appMatch[1].trim();
    entry.extractedType = 'App';
    data.apps.push(entry);
  }
}
// "Switched to app" lines
else if (line.includes('Switched to app')) {
  const appMatch = line.match(/Switched to app\s*:\s*(.+?)\s+at\s+\d+/i);
  if (appMatch && appMatch[1].trim() && !appMatch[1].includes('PII_HIDDEN')) {
    entry.extractedApp = appMatch[1].trim();
    entry.extractedType = 'App';
    data.apps.push(entry);
  }
}
// "Activating URL grabber for App" lines
else if (line.includes('for App :')) {
  const appMatch = line.match(/for App\s*:\s*(.+)/i);
  if (appMatch && appMatch[1].trim()) {
    entry.extractedApp = appMatch[1].trim();
    entry.extractedType = 'App';
    data.apps.push(entry);
  }
}
// WindowsGrabber "name:" lines (captures app name and version)
else if (line.includes('WindowsGrabber') && line.includes('name:')) {
  const appMatch = line.match(/name:\s*(.+?)\s+binary:/i);
  if (appMatch && appMatch[1].trim()) {
    entry.extractedApp = appMatch[1].trim();
    entry.extractedType = 'App';
    data.apps.push(entry);
  }
}

        // PutApplications JSON-style blocks - extract app names from name "AppName" or name AppName lines
else if (line.match(/^\s*name\s+["']?(.+?)["']?\s*$/)) {
  const appMatch = line.match(/^\s*name\s+["']?(.+?)["']?\s*$/);
  if (appMatch && appMatch[1].trim()) {
    const appName = appMatch[1].replace(/["']/g, '').trim();
    if (appName && appName !== 'applications' && appName !== 'platform') {
      entry.extractedApp = appName;
      entry.extractedType = 'App';
      data.apps.push(entry);
    }
  }
}

        // Injected / Simulated Input Detection
        // 1. Detect "Simulating missed input" - hardware not recognized properly
        if (line.includes('Simulating missed input')) {
          const simMatch = line.match(/Simulating missed input\s*\(([^)]+)\)/);
          entry.inputType = 'simulated';
          entry.inputDetail = simMatch ? simMatch[1] : 'Unknown device causing unrecognized input';
          data.injected.push(entry);
        }
        
        // 2. Detect actual injected input from WindowsInput lines (I>0 or LI>0)
        // Format: Mouse: clicks/Rmovement/Iinjected/LIlowlevel Keyboard: keys/Rraw/Iinjected/LIlowlevel
        if (line.includes('WindowsInput.cpp') && line.includes('Mouse:') && line.includes('Keyboard:')) {
          const inputMatch = line.match(/Mouse:\s*(\d+)\/R(\d+)\/I(\d+)\/LI(\d+)\s+Keyboard:\s*(\d+)\/R(\d+)\/I(\d+)\/LI(\d+)/);
          if (inputMatch) {
            const mouseInjected = parseInt(inputMatch[3]);
            const mouseLowIntegrity = parseInt(inputMatch[4]);
            const kbInjected = parseInt(inputMatch[7]);
            const kbLowIntegrity = parseInt(inputMatch[8]);
            const mouseReal = parseInt(inputMatch[2]);
            const kbReal = parseInt(inputMatch[6]);
            
            // Flag if there's injected input
            if (mouseInjected > 0 || mouseLowIntegrity > 0 || kbInjected > 0 || kbLowIntegrity > 0) {
              entry.inputType = 'injected';
              entry.mouseInjected = mouseInjected;
              entry.mouseLowIntegrity = mouseLowIntegrity;
              entry.kbInjected = kbInjected;
              entry.kbLowIntegrity = kbLowIntegrity;
              entry.mouseReal = mouseReal;
              entry.kbReal = kbReal;
              
              // Determine if this is "only injected" (no real input alongside)
              if ((mouseInjected > 0 || mouseLowIntegrity > 0) && mouseReal === 0 && 
                  (kbInjected > 0 || kbLowIntegrity > 0) && kbReal === 0) {
                entry.inputDetail = `Only injected - Mouse: I${mouseInjected}/LI${mouseLowIntegrity}, Keyboard: I${kbInjected}/LI${kbLowIntegrity}`;
                entry.onlyInjected = true;
              } else {
                entry.inputDetail = `Injected - Mouse: R${mouseReal}/I${mouseInjected}/LI${mouseLowIntegrity}, Keyboard: R${kbReal}/I${kbInjected}/LI${kbLowIntegrity}`;
                entry.onlyInjected = false;
              }
              data.injected.push(entry);
            }
          }
        }

        // Tracking events
        if (line.includes('Resume') || line.includes('Idle') || line.includes('Discard=') || line.includes('Startup') || line.includes('START_TRACKING') || line.includes('STOP_TRACKING')) {
          data.tracking.push(entry);
        }

        // Job Sites / Geofences - extract site details
        if (line.includes('creating geofence') && !line.includes('id=-')) {
          const siteMatch = line.match(/id=(\d+),\s*name=([^,]+),\s*loc\s*\(([^,]+),\s*([^,]+),\s*(\d+)\)/);
          if (siteMatch) {
            data.jobSites.push({
              id: siteMatch[1],
              name: siteMatch[2].trim(),
              lat: parseFloat(siteMatch[3]),
              lng: parseFloat(siteMatch[4]),
              radius: parseInt(siteMatch[5]),
              ts: ts
            });
          }
        }

        // User's current location
        if (line.includes('current location is AppLocation')) {
          const locMatch = line.match(/latitude=([^,]+),\s*longitude=([^,]+),\s*hAccuracy=([^)]+)/);
          if (locMatch) {
            data.userLocations.push({
              ts: ts,
              lat: parseFloat(locMatch[1]),
              lng: parseFloat(locMatch[2]),
              accuracy: parseFloat(locMatch[3])
            });
          }
        }

        // Currently entered sites
        if (line.includes('currently entered sites are:')) {
          const sitesMatch = line.match(/currently entered sites are:\s*\[([^\]]*)\]/);
          if (sitesMatch) {
            data.currentlyEnteredSites.push({
              ts: ts,
              sites: sitesMatch[1].trim()
            });
          }
        }

        // Geofence ENTER/EXIT events (for visit history)
        if (line.includes('handling geofence event') && line.includes('transitionType=')) {
          const typeMatch = line.match(/transitionType=(\w+)/);
          const latMatch = line.match(/latitude=([\d.-]+)/);
          const lngMatch = line.match(/longitude=([\d.-]+)/);
          const accMatch = line.match(/hAccuracy=([\d.]+)/);
          
          if (typeMatch && latMatch && lngMatch) {
            data.geofenceEvents.push({
              ts: ts,
              type: typeMatch[1],
              lat: parseFloat(latMatch[1]),
              lng: parseFloat(lngMatch[1]),
              accuracy: accMatch ? parseFloat(accMatch[1]) : null
            });
          }
        }
      }

      // === SILENT APP DETECTION ===
      // Scan all lines for silent app / corporate indicators
      const sa = data.silentApp;
      let lastSaTs = null;
      for (const line of lines) {
        const ts = parseTimestamp(line);
        if (ts) lastSaTs = ts;

        // Detect corporate/enterprise app (silent app indicator)
        if (line.includes('ENTERPRISE_INSTALL') || line.includes('enterprise.profile') || line.includes('Corporate')) {
          sa.detected = true;
          if (!sa.enterpriseProfile && line.includes('ENTERPRISE_INSTALL')) {
            const pathMatch = line.match(/installed:\s*(.+?)[\r\n]*$/);
            sa.enterpriseProfile = pathMatch ? pathMatch[1].trim() : 'Detected';
          }
        }

        if (line.includes('CORPORATE_LOGIN') || line.includes('CORPORATE_PROVISION')) {
          sa.detected = true;
          if (line.includes('CORPORATE_LOGIN')) {
            const userMatch = line.match(/for user:\s*(.+?)[\r\n]*$/);
            if (userMatch) sa.corporateUser = userMatch[1].trim();
          }
        }

        if (line.includes('profile corporate') || (line.includes('profile') && line.includes('corporate'))) {
          sa.detected = true;
        }

        // Only continue parsing silent app events if we've confirmed it's a silent app
        if (!sa.detected) continue;

        // Version extraction
        if (!sa.version) {
          if (line.includes('Client Version:') || line.includes('Core Version:')) {
            const verMatch = line.match(/Version:\s*([\d.]+[^\s\r\n]*)/);
            if (verMatch) sa.version = verMatch[1];
          } else if (line.includes('Running Current Version:')) {
            const verMatch = line.match(/Running Current Version:\s*([\d.]+[^\s\r\n]*)/);
            if (verMatch) sa.version = verMatch[1];
          } else if (line.includes('Version :')) {
            const verMatch = line.match(/Version\s*:\s*([\d.]+[^\s\r\n]*)/);
            if (verMatch) sa.version = verMatch[1];
          }
        }

        // Startups
        if (line.includes('STARTUP_CLEAN')) {
          sa.startups.push({ ts, type: 'CLEAN' });
        } else if (line.includes('STARTUP_UNCLEAN')) {
          sa.startups.push({ ts, type: 'UNCLEAN' });
        }

        // Shutdowns
        if (line.includes('(SHUTDOWN)')) {
          sa.shutdowns.push({ ts, reason: 'CLEAN' });
        }

        // Auth events
        if (line.includes('AUTH_TOKEN')) {
          const userMatch = line.match(/via token:\s*(.+?)(?:\s*\|\|\s*(\d+))?[\r\n]*$/);
          const email = userMatch ? userMatch[1].trim() : null;
          const userId = userMatch && userMatch[2] ? userMatch[2].trim() : null;
          sa.authEvents.push({ ts, type: 'TOKEN', user: email, userId });
          // Track unique authenticated users
          if (email || userId) {
            const key = userId || email;
            let existing = sa.authenticatedUsers.find(u => (userId && u.userId === userId) || (email && u.email === email));
            if (existing) {
              existing.lastSeen = ts;
              existing.authCount++;
              if (userId && !existing.userId) existing.userId = userId;
              if (email && !existing.email) existing.email = email;
            } else {
              sa.authenticatedUsers.push({ email, userId, firstSeen: ts, lastSeen: ts, authCount: 1 });
            }
          }
        } else if (line.includes('AUTH_OFFLINE')) {
          sa.authEvents.push({ ts, type: 'OFFLINE' });
        } else if (line.includes('CORPORATE_PROVISION_ATTEMPT_FAILED')) {
          sa.authEvents.push({ ts, type: 'PROVISION_FAIL' });
        }

        // Resume events
        if (line.includes('RESUME_DETECTED')) {
          const durMatch = line.match(/Duration:\s*([\d:]+)/);
          const startMatch = line.match(/Start time:\s*([^\r\n]+)/);
          sa.resumes.push({
            ts, type: 'DETECTED',
            duration: durMatch ? durMatch[1].trim() : null,
            startTime: startMatch ? startMatch[1].trim() : null
          });
        } else if (line.includes('RESUME_IGNORED')) {
          const startMatch = line.match(/StartTime:\s*([^\r\n]+)/);
          sa.resumes.push({ ts, type: 'IGNORED', startTime: startMatch ? startMatch[1].trim() : null });
        } else if (line.includes('RESUME_NEEDS_CONFIRMATION')) {
          sa.resumes.push({ ts, type: 'NEEDS_CONFIRM' });
        } else if (line.includes('RESUME_TRACKING')) {
          sa.resumes.push({ ts, type: 'TRACKING' });
        }

        // No monitors detected (screen sleep)
        if (line.includes('CAPTURE_DESKTOP') && line.includes('No monitors detected')) {
          sa.captureDesktop.push({ ts });
        }

        // Helper died
        if (line.includes('Helper died')) {
          sa.helperDied++;
          sa.helperDiedEvents.push({ ts });
        }

        // Stop errors
        if (line.includes('STOP_ERROR')) {
          sa.stopErrors.push({ ts, msg: line.substring(0, 200) });
        }

        // CORPORATE_PROVISION_ATTEMPT_FAILED
        if (line.includes('CORPORATE_PROVISION_ATTEMPT_FAILED')) {
          sa.authEvents.push({ ts, type: 'PROVISION_FAIL' });
        }

        // System memory from helper logs (collect all snapshots + set first as primary)
        if (line.includes('Client MEM:')) {
          const memMatch = line.match(/System Mem:\s*(\d+)\s*\/\s*(\d+)/);
          const pageMatch = line.match(/Pagefile:\s*(\d+)\s*\/\s*(\d+)/);
          const workMatch = line.match(/WorkingSet:\s*(\d+)\s*\/\s*(\d+)/);
          if (memMatch) {
            const snapshot = {
              ts,
              usedBytes: parseInt(memMatch[1]),
              totalBytes: parseInt(memMatch[2]),
              pagefileUsed: pageMatch ? parseInt(pageMatch[1]) : null,
              pagefileTotal: pageMatch ? parseInt(pageMatch[2]) : null,
              workingSet: workMatch ? parseInt(workMatch[1]) : null,
              workingSetPeak: workMatch ? parseInt(workMatch[2]) : null
            };
            sa.systemMemSnapshots.push(snapshot);
            if (!sa.systemMem) sa.systemMem = snapshot;
          }
        }

        // Phase 3: Resume threshold config
        if (line.includes('resume_threshold')) {
          // Look ahead - the next few lines have keep/discard values
          // We parse this separately after the loop
          sa._resumeThresholdFound = true;
        }
        if (sa._resumeThresholdFound && !sa.resumeThreshold) {
          const keepMatch = line.match(/keep\s+([\d:]+)/);
          const discardMatch = line.match(/discard\s+([\d:]+)/);
          if (keepMatch) {
            if (!sa._rtKeep) sa._rtKeep = keepMatch[1];
          }
          if (discardMatch) {
            sa.resumeThreshold = { keep: sa._rtKeep || 'unknown', discard: discardMatch[1] };
            delete sa._resumeThresholdFound;
            delete sa._rtKeep;
          }
        }

        // Phase 3: AUTO_START_STOP events
        if (line.includes('AUTO_START_STOP') && line.includes('START_TRACKING')) {
          sa.autoStartStops.push({ ts, type: 'START', detail: 'Auto-start triggered by activity detection' });
        } else if (line.includes('AUTO_START_STOP') && line.includes('STOP_TRACKING')) {
          sa.autoStartStops.push({ ts, type: 'STOP', detail: 'Auto-stop triggered by inactivity' });
        } else if (line.includes('AUTO_START_NO_ACTIVTY')) {
          sa.autoStartStops.push({ ts, type: 'NO_ACTIVITY', detail: 'Inactivity timeout while idle' });
        }

        // Phase 3: PENDING_DETECTED
        if (line.includes('PENDING_DETECTED')) {
          sa.pendingDetected.push({ ts });
        }

        // Phase 4: SSL errors + URL extraction
        if (line.includes('SSL') && (line.includes('error') || line.includes('Error') || line.includes('timeout'))) {
          sa.sslErrors.push({ ts, msg: line.substring(0, 200).trim() });
        }

        // Phase 4: HTTP 429 rate limiting
        if (line.includes('Response: 429') || line.includes('Too Many Requests')) {
          sa.http429s.push({ ts, msg: line.substring(0, 200).trim() });
        }

        // Phase 4: Network block URL extraction
        // Capture failed request URLs from tag_http_request_url
        const urlTagMatch = line.match(/\[Exception::tag_http_request_url\*\]\s*=\s*(https?:\/\/[^\s\r\n]+)/);
        if (urlTagMatch) {
          const url = urlTagMatch[1].trim();
          try {
            const hostname = new URL(url).hostname;
            const endpoint = new URL(url).pathname.replace(/\/[a-f0-9]{20,}[^\s\/]*/g, '/*').replace(/\/\d{4}\/\d{2}\/\d+\/[^\/]+\/[^\/]+$/, '/…');
            // Determine error type from surrounding context
            let errorType = 'network';
            if (line.includes('SSL') || line.includes('ssl')) errorType = 'ssl';
            else if (line.includes('Timeout') || line.includes('timeout')) errorType = 'timeout';

            sa.networkBlocks.failedUrls.push({ ts: ts || lastSaTs, url, errorType, domain: hostname, endpoint });
            
            if (!sa.networkBlocks.blockedDomains[hostname]) {
              sa.networkBlocks.blockedDomains[hostname] = { count: 0, endpoints: new Set(), errorTypes: new Set(), firstSeen: ts || lastSaTs, lastSeen: ts || lastSaTs };
            }
            const dom = sa.networkBlocks.blockedDomains[hostname];
            dom.count++;
            dom.endpoints.add(endpoint);
            dom.errorTypes.add(errorType);
            if (ts) dom.lastSeen = ts;
          } catch(e) { /* invalid URL */ }
        }

        // Capture "connection to domain:port" from SSL error details
        const connMatch = line.match(/connection to ([a-zA-Z0-9._-]+\.(?:com|net|org|io|amazonaws\.com)):(\d+)/);
        if (connMatch) {
          const hostname = connMatch[1];
          if (!sa.networkBlocks.blockedDomains[hostname]) {
            sa.networkBlocks.blockedDomains[hostname] = { count: 0, endpoints: new Set(), errorTypes: new Set(), firstSeen: ts || lastSaTs, lastSeen: ts || lastSaTs };
          }
          const dom = sa.networkBlocks.blockedDomains[hostname];
          dom.count++;
          dom.errorTypes.add('ssl');
          if (ts) dom.lastSeen = ts;
        }

        // Capture "Network Error uploading X" as network failures
        const uploadErrMatch = line.match(/Network Error uploading (\w+)/);
        if (uploadErrMatch) {
          sa.networkBlocks.failedUrls.push({ ts, url: null, errorType: 'upload_fail', domain: 'client-api.hubstaff.com', endpoint: uploadErrMatch[1] });
          if (!sa.networkBlocks.blockedDomains['client-api.hubstaff.com']) {
            sa.networkBlocks.blockedDomains['client-api.hubstaff.com'] = { count: 0, endpoints: new Set(), errorTypes: new Set(), firstSeen: ts, lastSeen: ts };
          }
          sa.networkBlocks.blockedDomains['client-api.hubstaff.com'].count++;
          sa.networkBlocks.blockedDomains['client-api.hubstaff.com'].errorTypes.add('upload_fail');
        }

        // Track last timestamp for continuation lines
        // (lastSaTs updated at top of loop)
      }

      // Phase 3: Detect double-starts (START_TRACKING without preceding STOP_TRACKING)
      const trackingEvents = [];
      for (const line of lines) {
        const ts = parseTimestamp(line);
        if (line.includes('START_TRACKING')) trackingEvents.push({ ts, type: 'START' });
        else if (line.includes('STOP_TRACKING')) trackingEvents.push({ ts, type: 'STOP' });
      }
      trackingEvents.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      let lastTrackEvent = null;
      for (const ev of trackingEvents) {
        if (ev.type === 'START' && lastTrackEvent && lastTrackEvent.type === 'START') {
          sa.doubleStarts.push({ ts: ev.ts });
        }
        lastTrackEvent = ev;
      }

      // === SCREENSHOT HEALTH ANALYSIS ===
      const sh = data.screenshotHealth;
      const _sa = data.silentApp;
      
      // Check 1: Screen sleep during active tracking periods
      // Build tracking windows from audit events
      const trackWindows = [];
      let trackStart = null;
      for (const line of lines) {
        const ts = parseTimestamp(line);
        if (line.includes('START_TRACKING')) trackStart = ts;
        else if (line.includes('STOP_TRACKING') && trackStart) {
          trackWindows.push({ start: trackStart, end: ts });
          trackStart = null;
        }
      }
      // Check if any screen sleep happened during tracking
      if (_sa.detected) {
        _sa.captureDesktop.forEach(cd => {
          for (const w of trackWindows) {
            if (cd.ts >= w.start && cd.ts <= w.end) {
              sh.sleepDuringTracking.push({ ts: cd.ts });
              break;
            }
          }
        });
      }
      
      // Check 2: Helper crashes near capture events
      if (_sa.detected && _sa.helperDiedEvents.length > 0 && sh.captures.length > 0) {
        const NEAR_THRESHOLD = 60000; // 60 seconds
        _sa.helperDiedEvents.forEach(hd => {
          sh.captures.forEach(cap => {
            if (cap.ts && hd.ts && Math.abs(cap.ts - hd.ts) < NEAR_THRESHOLD) {
              sh.helperCrashNearCapture++;
            }
          });
        });
      }
      
      // Check 3: Deduplicate security software detections
      const seenSw = new Set();
      sh.securitySoftware = sh.securitySoftware.filter(s => {
        const key = s.name.toLowerCase();
        if (seenSw.has(key)) return false;
        seenSw.add(key);
        return true;
      });
      
      // Build risk factors
      // Factor: Uploads without captures (app says it uploaded but may not have actually captured properly)
      if (sh.uploads.length > 0 && sh.captures.length === 0) {
        sh.blankRiskFactors.push({
          reason: 'Uploads Without Captures',
          detail: `Found ${sh.uploads.length} upload events but no capture events. The app may be uploading placeholder/blank images.`,
          severity: 'warning'
        });
      }
      
      // Factor: Screen sleep during tracking
      if (sh.sleepDuringTracking.length > 0) {
        sh.blankRiskFactors.push({
          reason: 'Screen Sleep During Tracking',
          detail: `The monitor went to sleep ${sh.sleepDuringTracking.length} time(s) while tracking was active. Screenshots captured during or after screen sleep will be blank/black.`,
          severity: 'warning'
        });
      }
      
      // Factor: Security software detected
      if (sh.securitySoftware.length > 0) {
        const names = sh.securitySoftware.map(s => s.name).join(', ');
        sh.blankRiskFactors.push({
          reason: 'Security Software Detected',
          detail: `Found ${names} in logs. Antivirus, web-shield, and internet security software are known to interfere with Hubstaff's screenshot function, causing blank or black images.`,
          severity: 'warning'
        });
      }
      
      // Factor: Screen recording permission issues
      if (sh.permissionIssues.length > 0) {
        sh.blankRiskFactors.push({
          reason: 'Screen Recording Permission Issue',
          detail: `Found ${sh.permissionIssues.length} permission-related event(s). On macOS, if screen recording permission is not granted, all screenshots will appear as blank desktop backgrounds without any window content.`,
          severity: 'critical'
        });
      }
      
      // Factor: Excessive helper crashes (helper captures screenshots)
      if (_sa.detected && _sa.helperDied >= 50) {
        sh.blankRiskFactors.push({
          reason: 'Excessive Helper Crashes',
          detail: `The helper process (which captures screenshots) crashed ${_sa.helperDied} times. This can cause missed or corrupted screenshots.`,
          severity: 'warning'
        });
      }
      
      // Factor: Helper crashes near capture times
      if (sh.helperCrashNearCapture > 0) {
        sh.blankRiskFactors.push({
          reason: 'Helper Crashes Near Capture',
          detail: `The helper process crashed ${sh.helperCrashNearCapture} time(s) within 60 seconds of a screenshot capture. These screenshots are likely blank or missing.`,
          severity: 'critical'
        });
      }
      
      // Factor: Rate limiting on /screens endpoint
      if (_sa.detected && _sa.http429s.length > 0) {
        const screensRateLimit = _sa.http429s.filter(h => h.msg && h.msg.includes('/screens'));
        if (screensRateLimit.length > 0) {
          sh.blankRiskFactors.push({
            reason: 'Screenshot Upload Rate Limited',
            detail: `${screensRateLimit.length} HTTP 429 rate limit responses on the /screens endpoint. Rate-limited screenshots may fail to upload or appear as missing in the dashboard.`,
            severity: 'warning'
          });
        }
      }
      
      // Factor: Explicit failures
      if (sh.failures.length > 0) {
        sh.blankRiskFactors.push({
          reason: 'Screenshot Capture/Upload Failures',
          detail: `${sh.failures.length} explicit screenshot failure(s) detected in the logs.`,
          severity: 'critical'
        });
      }
      
      // Factor: Screenshots present but with known blank-causing patterns
      // If we see uploads happening but the OS is macOS and no permission confirmation found
      const isMac = lines.some(l => /macOS|darwin|CFBundle|NSApplication|kCLError|\.app\/Contents/i.test(l));
      const hasPermConfirm = lines.some(l => /screen.?recording.*(granted|allowed|enabled|true)/i.test(l));
      if (isMac && sh.uploads.length > 0 && !hasPermConfirm && sh.permissionIssues.length === 0) {
        sh.blankRiskFactors.push({
          reason: 'macOS — No Screen Recording Permission Confirmation',
          detail: 'This appears to be a macOS device with screenshot uploads, but no log confirmation that screen recording permission was granted. On macOS 10.15+, without this permission, Hubstaff captures screenshots that show only the desktop wallpaper — no windows or content. The user (or their IT admin) needs to grant Screen Recording permission in System Settings → Privacy & Security.',
          severity: 'info'
        });
      }

      return data;
    }

