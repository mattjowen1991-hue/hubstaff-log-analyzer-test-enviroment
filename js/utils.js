    const $ = id => document.getElementById(id);
    const pad = n => String(n).padStart(2, '0');

    // === VIRTUAL SCROLL TABLE ===
    // Renders only visible rows for large datasets (1000+ rows)
    // Falls back to regular rendering for small datasets
    const VIRTUAL_THRESHOLD = 100; // Use virtual scroll above this count
    const VIRTUAL_ROW_HEIGHT = 32; // px per row
    const VIRTUAL_BUFFER = 10;     // extra rows above/below viewport

    const virtualTableInstances = {}; // Track active instances for cleanup

    function createVirtualTable(wrapId, tbodyId, items, rowRenderer, emptyMsg) {
      const tbody = $(tbodyId);
      const wrap = tbody.closest('.table-wrap');
      
      // Cleanup previous instance if exists
      if (virtualTableInstances[wrapId]) {
        const prev = virtualTableInstances[wrapId];
        if (prev.scrollHandler) prev.wrap.removeEventListener('scroll', prev.scrollHandler);
        delete virtualTableInstances[wrapId];
      }

      // Small dataset — render all directly (no virtual scroll needed)
      if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--muted)">${emptyMsg || 'No events found'}</td></tr>`;
        return;
      }
      if (items.length <= VIRTUAL_THRESHOLD) {
        tbody.innerHTML = items.map(rowRenderer).filter(r => r !== '').join('');
        return;
      }

      // Virtual scroll mode
      const table = tbody.closest('table');
      const thead = table.querySelector('thead');
      
      // Get the wrap's max-height for viewport calc
      const wrapHeight = parseInt(wrap.style.maxHeight) || 250;
      const totalHeight = items.length * VIRTUAL_ROW_HEIGHT;
      const visibleCount = Math.ceil(wrapHeight / VIRTUAL_ROW_HEIGHT);

      // Create spacer for total scrollable height
      // We put it as a single row with height = totalHeight
      function renderVisibleRows() {
        const scrollTop = wrap.scrollTop;
        const theadHeight = thead ? thead.offsetHeight : 30;
        const adjustedScroll = Math.max(0, scrollTop - theadHeight);
        
        const startIdx = Math.max(0, Math.floor(adjustedScroll / VIRTUAL_ROW_HEIGHT) - VIRTUAL_BUFFER);
        const endIdx = Math.min(items.length, startIdx + visibleCount + VIRTUAL_BUFFER * 2);
        
        const topPad = startIdx * VIRTUAL_ROW_HEIGHT;
        const bottomPad = (items.length - endIdx) * VIRTUAL_ROW_HEIGHT;
        
        let html = '';
        if (topPad > 0) {
          html += `<tr class="vs-spacer"><td colspan="4" style="height:${topPad}px;padding:0;border:none;"></td></tr>`;
        }
        for (let i = startIdx; i < endIdx; i++) {
          const row = rowRenderer(items[i], i);
          if (row !== '') html += row;
        }
        if (bottomPad > 0) {
          html += `<tr class="vs-spacer"><td colspan="4" style="height:${bottomPad}px;padding:0;border:none;"></td></tr>`;
        }
        
        tbody.innerHTML = html;
      }

      // Initial render
      renderVisibleRows();

      // Throttled scroll handler
      let scrollRaf = null;
      const scrollHandler = () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          renderVisibleRows();
          scrollRaf = null;
        });
      };

      wrap.addEventListener('scroll', scrollHandler, { passive: true });
      
      // Store instance for cleanup
      virtualTableInstances[wrapId] = { wrap, scrollHandler };
    }

    let allLines = [];
    let fullParsedData = null; // Store unfiltered data for date filtering
    let userTzOffsetMs = null;

    // === TIMEZONE HANDLING ===
    function parseTzOffset(str) {
      if (!str || !str.trim()) return null;
      str = str.trim();
      let sign = 1;
      if (str.startsWith('-')) { sign = -1; str = str.slice(1); }
      else if (str.startsWith('+')) { str = str.slice(1); }
      let hours = 0, mins = 0;
      if (str.includes(':')) {
        const parts = str.split(':');
        hours = parseInt(parts[0]) || 0;
        mins = parseInt(parts[1]) || 0;
      } else {
        hours = parseFloat(str) || 0;
        mins = Math.round((hours - Math.floor(hours)) * 60);
        hours = Math.floor(hours);
      }
      return sign * (hours * 60 + mins) * 60 * 1000;
    }

    function updateTzLabel() {
      const offset = parseTzOffset($('tzOffset').value);
      if (offset !== null) {
        const hrs = Math.floor(Math.abs(offset) / 3600000);
        const mns = Math.floor((Math.abs(offset) % 3600000) / 60000);
        const sgn = offset >= 0 ? '+' : '-';
        $('tzLabel').textContent = 'UTC' + sgn + hrs + (mns ? ':' + pad(mns) : '');
        $('tzLabel').style.color = 'var(--success)';
        userTzOffsetMs = offset;
      } else {
        $('tzLabel').textContent = $('tzOffset').value ? '⚠️ Invalid' : '';
        $('tzLabel').style.color = 'var(--warn)';
        userTzOffsetMs = null;
      }
    }

    function fmtTimeWithTz(date, includeDate = false) {
      if (!date) return '--';
      
      if ($('userTzMode')?.checked && userTzOffsetMs !== null) {
        const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
        const userDate = new Date(utcMs + userTzOffsetMs);
        if (includeDate) {
          return userDate.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}) + ' ' + 
                 userDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) + ' ★';
        }
        return userDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) + ' ★';
      }
      
      if (includeDate) {
        return date.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}) + ' ' + date.toLocaleTimeString();
      }
      return date.toLocaleTimeString();
    }

    // === DATE FILTERING ===
    function filterByDate(data) {
      if (!data) return data;
      
      const fromVal = $('dateFrom').value;
      const toVal = $('dateTo').value;
      if (!fromVal && !toVal) return data;
      
      const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
      const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;
      
      const filterByTs = (item) => {
        if (!item.ts) return true;
        if (fromDate && item.ts < fromDate) return false;
        if (toDate && item.ts > toDate) return false;
        return true;
      };
      
      // Recalculate idle from filtered events
      let idleKeptSecs = 0, idleDiscardedSecs = 0;
      const filteredIdleDecisions = data.idleDecisions.filter(filterByTs);
      filteredIdleDecisions.forEach(d => {
        if (d.decision === 'KEPT') idleKeptSecs += d.seconds;
        else idleDiscardedSecs += d.seconds;
      });
      
      return {
        ...data,
        errors: data.errors.filter(filterByTs),
        warnings: data.warnings.filter(filterByTs),
        screenshots: data.screenshots.filter(filterByTs),
        network: data.network.filter(filterByTs),
        locations: data.locations.filter(filterByTs),
        apps: data.apps.filter(filterByTs),
        tracking: data.tracking.filter(filterByTs),
        injected: data.injected.filter(filterByTs),
        sessions: data.sessions.filter(s => {
          if (fromDate && s.start < fromDate) return false;
          if (toDate && s.stop && s.stop > toDate) return false;
          return true;
        }),
        idleDecisions: filteredIdleDecisions,
        idleKeptSecs,
        idleDiscardedSecs,
        jobSites: data.jobSites,
        userLocations: data.userLocations.filter(filterByTs),
        currentlyEnteredSites: data.currentlyEnteredSites.filter(filterByTs),
        geofenceEvents: (data.geofenceEvents || []).filter(filterByTs)
      };
    }

    // === HAVERSINE DISTANCE (for matching user location to job sites) ===
    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    function findNearestSite(lat, lng, sites) {
      let nearest = null;
      let minDist = Infinity;
      
      for (const site of sites) {
        const dist = haversineDistance(lat, lng, site.lat, site.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = { ...site, distance: Math.round(dist) };
        }
      }
      return nearest;
    }

    function generateMapLink(lat, lng, label = 'View on Map') {
      const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      return `<a href="${googleUrl}" target="_blank" rel="noopener" class="map-link" title="Open in Google Maps">🗺️ ${label}</a>`;
    }
    let parsedData = null;
    let timelineMin = null;
    let timelineDur = null;
    let selectedMarker = null;

    // === iOS/LOCATION LOG PATTERNS ===
    const LOCATION_PATTERNS = {
      errors: [
        { pattern: /\[Position\] Couldn't obtain location.*denied.*Code=1/i, meaning: "📍 Location permission DENIED at iOS level", action: "User must go to iOS Settings → Privacy & Security → Location Services → Hubstaff → select 'Always'. The app requested location but iOS blocked it because permission is set to 'Never' or 'While Using'." },
        { pattern: /\[Position\] Couldn't obtain location.*Code=0/i, meaning: "📍 Location unknown - device couldn't determine position", action: "GPS signal may be weak. Have user try outdoors with clear sky view, or check if Location Services are enabled globally." },
        { pattern: /\[Position\] Couldn't obtain location/i, meaning: "📍 Device cannot access user's location", action: "Check if location services are enabled and permissions are set to 'Always'" },
        { pattern: /\[Site\] Region issue/i, meaning: "📍 Problem monitoring job site region", action: "May affect job site detection. Check location permissions and GPS signal." },
        { pattern: /\[LocationResolution\].*error/i, meaning: "📍 Failed to resolve location name", action: "Geocoding issue - may show coordinates instead of address names." },
        { pattern: /kCLErrorDomain Code=1/i, meaning: "📍 iOS Location Permission Denied (kCLErrorDomain)", action: "This iOS error means location permission is denied. Go to Settings → Hubstaff → Location → 'Always'." },
        { pattern: /kCLErrorDomain Code=0/i, meaning: "📍 iOS Location Unknown (kCLErrorDomain)", action: "iOS couldn't determine location. Check GPS signal, try outdoors, ensure Location Services are ON globally." },
        // Android network/DNS errors
        { pattern: /Could not resolve host/i, meaning: "🌐 DNS Resolution Failed - No Internet", action: "Device cannot reach Hubstaff servers. Check: WiFi/mobile data is ON, airplane mode is OFF, try switching networks." },
        { pattern: /Network Error.*code=6/i, meaning: "🌐 Network Error Code 6 - Cannot Resolve DNS", action: "Device has no working internet connection. Network/WiFi may be connected but not working." },
        { pattern: /UnknownHostException/i, meaning: "🌐 Java DNS Error - No Internet", action: "Android cannot resolve server addresses. Check internet connectivity." },
        { pattern: /Unable to update the tokens/i, meaning: "🔐 Token Refresh Failed - Network Issue", action: "Could not refresh login session. Usually caused by no internet connection." },
        { pattern: /failed to request current location.*cancelled/i, meaning: "📍 Location Request Cancelled", action: "Location update was cancelled. May be due to app being backgrounded or permission issue." },
      ],
      audit: [
        { pattern: /Locations needed but non-primary device/i, meaning: "📱 Can't track - this isn't the primary device", action: "User needs to tap the banner to make this device primary, or use their primary device." },
        { pattern: /Locations needed but unavailable/i, meaning: "📍 Can't track - location not available", action: "Check: Location Services ON, Hubstaff permission set to 'Always', Precise Location ON" },
        { pattern: /Must visit.*currently at/i, meaning: "📍 Can't start timer - not at a job site", action: "User must be physically at a job site to start tracking (Restrict timer to job sites is ON)" },
        { pattern: /\[Site\] Handle.*ENTER.*passive/i, meaning: "📍 Entered job site (detected in background)", action: null },
        { pattern: /\[Site\] Handle.*ENTER.*active/i, meaning: "📍 Entered job site (while tracking)", action: null },
        { pattern: /\[Site\] Handle.*EXIT.*passive/i, meaning: "📍 Left job site (detected in background)", action: null },
        { pattern: /\[Site\] Handle.*EXIT.*active/i, meaning: "📍 Left job site (while tracking)", action: null },
        { pattern: /auto-start project/i, meaning: "▶️ Timer auto-started by job site rule", action: null },
        { pattern: /auto-stop project/i, meaning: "⏹️ Timer auto-stopped by job site rule", action: null },
        { pattern: /DID NOT auto-start.*was prevented/i, meaning: "⚠️ Job site tried to auto-start but was blocked", action: "Check logs above this for the specific reason." },
        { pattern: /DID NOT auto-start.*already tracking/i, meaning: "ℹ️ Job site didn't auto-start - already tracking another project", action: "Normal behavior - won't interrupt current work." },
        { pattern: /WILL NOT auto-start.*not primary/i, meaning: "📱 Job site won't auto-start - not primary device", action: "User needs to make this device primary." },
        { pattern: /DID NOT auto-stop.*is tracking project/i, meaning: "ℹ️ Job site didn't auto-stop - tracking different project", action: "Normal - only stops if tracking the site's configured project." },
        { pattern: /WILL NOT auto-stop.*not primary/i, meaning: "📱 Job site won't auto-stop - not primary device", action: "User needs to make this device primary." },
        { pattern: /notify reminder/i, meaning: "🔔 Sent reminder notification to user", action: null },
        // Android tracking blocked events
        { pattern: /TRACKING_NOT_STARTED.*requires being at a job site/i, meaning: "🚫 Timer Blocked - Not At Required Job Site", action: "User tried to start timer but is not at a configured job site. Organization has 'Restrict timer to job sites' enabled." },
        { pattern: /Timer could not be started.*requires being at a job site/i, meaning: "🚫 Timer Blocked - Job Site Restriction", action: "The organization requires users to be physically at a job site to start tracking. User is not at any configured site." },
        // Android startup events
        { pattern: /STARTUP_UNCLEAN/i, meaning: "⚠️ App crashed or was force-closed last time", action: "The app didn't shut down properly. May have lost unsaved data. Check if user force-closed it or if Android killed it." },
        { pattern: /STARTUP_CLEAN/i, meaning: "✅ App started normally after clean shutdown", action: null },
        { pattern: /\(FOREGROUNDED\)/i, meaning: "📱 App brought to foreground", action: null },
        { pattern: /\(BACKGROUNDED\)/i, meaning: "📱 App sent to background", action: null },
      ],
      info: [
        { pattern: /\[LocationRequest\].*not the user's primary device/i, meaning: "📱 Location request ignored - not primary device", action: "Only the primary device reports locations." },
        { pattern: /\[LocationRequest\].*locations are not available/i, meaning: "📍 Location request failed - unavailable", action: "Check location permissions and services." },
        { pattern: /\[LocationRequest\].*neither active or passive/i, meaning: "📍 Location request ignored - not recording", action: "Track Locations may be Off, or timer not running." },
        { pattern: /Discarding simulated locations/i, meaning: "🚫 Fake/simulated location detected and ignored", action: "User may be using a location spoofing app - this is blocked." },
        { pattern: /\[Site\] REGION STOP/i, meaning: "📍 Stopped monitoring a job site region", action: null },
        { pattern: /\[Site\] REGION START/i, meaning: "📍 Started monitoring a job site region", action: null },
        { pattern: /suspicious movement/i, meaning: "🚗 Fast movement detected - rechecking job sites", action: "User may be driving away from site." },
        // Android permission and status patterns
        { pattern: /permission state is State.*BACKGROUND_LOCATION.*enabled=false/i, meaning: "⚠️ Android Background Location Permission DENIED", action: "User must enable 'Allow all the time' for location: Settings → Apps → Hubstaff → Permissions → Location." },
        { pattern: /permission state is State.*BACKGROUND_LOCATION.*enabled=true/i, meaning: "✅ Android Background Location Granted", action: null },
        { pattern: /locationState is \[SERVICES_ENABLED, PERMISSIONS_ENABLED, ACCURACY_ENABLED\]/i, meaning: "✅ Android Location Services Fully Enabled", action: null },
        { pattern: /isIgnoringBatteryOptimization.*=false/i, meaning: "🔋 Battery Optimization ENABLED - May Kill App", action: "Disable battery optimization: Settings → Apps → Hubstaff → Battery → Unrestricted" },
        { pattern: /isIgnoringBatteryOptimization.*=true/i, meaning: "✅ Battery Optimization Correctly Disabled", action: null },
        // Android geofence events
        { pattern: /handling geofence event.*transitionType=ENTER/i, meaning: "📍 Entered Geofence Area", action: null },
        { pattern: /handling geofence event.*transitionType=EXIT/i, meaning: "📍 Exited Geofence Area", action: null },
        { pattern: /updated \d+ geofences succesfully/i, meaning: "✅ Job Site Geofences Registered", action: null },
        { pattern: /sites count:.*wrappers count:/i, meaning: "📍 Job Sites Loaded", action: null },
        // Android motion detection
        { pattern: /motion event.*VEHICLE/i, meaning: "🚗 Driving Activity Detected", action: null },
        { pattern: /motion event.*STILL/i, meaning: "🧍 Stationary Activity Detected", action: null },
      ],
      trace: [
        { pattern: /Primary changed/i, meaning: "📱 Primary device status changed", action: null },
        { pattern: /Location Availability changed/i, meaning: "📍 Location availability changed", action: null },
        { pattern: /Recording changed/i, meaning: "📍 Location recording state changed", action: null },
        { pattern: /AccuracyLimited changed/i, meaning: "🔋 Location accuracy limited (low power/hot device)", action: null },
      ],
      // iOS-specific permission states
      permissions: [
        { pattern: /device_locations=undetermined/i, meaning: "📍 Location permission NOT YET REQUESTED", action: "User hasn't been prompted for location permission yet. They need to open the app and respond to the permission prompt, or go to Settings → Hubstaff → Location → 'Always'." },
        { pattern: /device_locations=denied/i, meaning: "📍 Location permission DENIED", action: "User denied location permission. Go to iOS Settings → Privacy & Security → Location Services → Hubstaff → select 'Always'." },
        { pattern: /device_locations=restricted/i, meaning: "📍 Location permission RESTRICTED", action: "Location is restricted by device management (MDM) or parental controls. Contact IT admin to allow location access for Hubstaff." },
        { pattern: /device_locations=authorizedWhenInUse/i, meaning: "📍 Location set to 'While Using' - NOT SUFFICIENT", action: "Location is set to 'While Using App' which won't work for background tracking. User must change to 'Always' in iOS Settings → Hubstaff → Location." },
        { pattern: /device_locations=authorizedAlways/i, meaning: "📍 Location permission correctly set to 'Always'", action: null },
        { pattern: /status=notDetermined/i, meaning: "📍 iOS location permission not yet determined", action: "User needs to respond to the location permission prompt, or manually enable in Settings → Hubstaff → Location → 'Always'." },
      ]
    };

    function checkLocationPatterns(msg, level) {
      const patterns = LOCATION_PATTERNS[level.toLowerCase()] || [];
      for (const p of patterns) {
        if (p.pattern.test(msg)) return { text: p.meaning, action: p.action };
      }
      for (const lvl of ['errors', 'audit', 'info', 'trace', 'permissions']) {
        for (const p of LOCATION_PATTERNS[lvl] || []) {
          if (p.pattern.test(msg)) return { text: p.meaning, action: p.action };
        }
      }
      return null;
    }

    // === NOISE FILTER PATTERNS ===
    const NOISE_PATTERNS = [
      /WindowsInput\.cpp/,
      /InputExtension\.h/,
      /Heart beat\s*:/i,
      /Response:\s*200\b/,
      /Response:\s*201\b/,
      /Response:\s*204\b/,
      /Check CURL Response/i,
      /Storage\.h.*Read/i,
    ];

    const HELPER_CLIENT_PATTERN = /HelperClient\.cpp/;
    const HELPER_CLIENT_KEEP = /(URL:|APP:|TITLE:)/i;
    const STORAGE_IO_WROTE_PATTERN = /StorageIO.*Wrote/i;
    const STORAGE_IO_KEEP = /(Location|TrackedActivity)/i;

    const SIGNAL_PATTERNS = [
      /\[ERROR\]/i, /\[WARN\]/i, /\[AUDIT\]/i,
      /main_watchdog hit/i, /OS Memory/i, /Helper died/i, /Startup/i,
      /Discard=/i, /\bResume\b/i, /\bIdle\b/i,
      /Server Error/i, /Possible traffic issue/i,
      /Response:\s*4\d{2}/, /Response:\s*5\d{2}/,
      /Uploading Screen/i, /Capture Screen/i, /Wrote ScreenData/i,
      /feed:\s*sites/i, /LocationFeatureState/i, /LocationManager/i,
      /Simulating missed input/i,  // Important for detecting hardware input issues
    ];

    const APP_GRABBER_PATTERN = /ApplicationGrabber/i;
    const APP_GRABBER_KEEP = /(URL:|TITLE:)/i;

    function isSignal(line) {
      for (const p of SIGNAL_PATTERNS) if (p.test(line)) return true;
      if (APP_GRABBER_PATTERN.test(line) && APP_GRABBER_KEEP.test(line)) return true;
      if (HELPER_CLIENT_PATTERN.test(line) && HELPER_CLIENT_KEEP.test(line)) return true;
      return false;
    }

    function isNoise(line) {
      for (const p of NOISE_PATTERNS) if (p.test(line)) return true;
      if (HELPER_CLIENT_PATTERN.test(line) && !HELPER_CLIENT_KEEP.test(line)) return true;
      if (STORAGE_IO_WROTE_PATTERN.test(line) && !STORAGE_IO_KEEP.test(line)) return true;
      return false;
    }

    function filterLogs(lines) {
      return lines.filter(line => {
        if (!line.trim()) return false;
        if (isSignal(line)) return true;
        if (isNoise(line)) return false;
        return true;
      });
    }

    function parseTimestamp(line) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
      if (!m) return null;
      return new Date(`${m[1]}T${m[2]}`);
    }

    function parseTimezone(line) {
      // Check for explicit TZ Offset line (e.g., "TZ Offset  : 05:30:00" or "TZ Offset  : -05:30:00")
      const tzOffsetMatch = line.match(/TZ Offset\s*:\s*(-?)(\d{2}):(\d{2})/i);
      if (tzOffsetMatch) {
        const sign = tzOffsetMatch[1] === '-' ? '-' : '+';
        return `${sign}${tzOffsetMatch[2]}:${tzOffsetMatch[3]}`;
      }
      
      // Check for timestamp suffix timezone (e.g., "+0530" or "-08:00")
      const m = line.match(/([+-]\d{2}:?\d{2})\s*$/);
      if (m) {
        let tz = m[1];
        if (!tz.includes(':')) tz = tz.slice(0,3) + ':' + tz.slice(3);
        return tz;
      }
      const m2 = line.match(/\s([+-]\d{4})\s/);
      if (m2) {
        const tz = m2[1];
        return tz.slice(0,3) + ':' + tz.slice(3);
      }
      return null;
    }

    function fmtDuration(secs) {
      if (!secs || secs < 0) return '0:00:00';
      secs = Math.floor(secs);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${h}:${pad(m)}:${pad(s)}`;
    }

    function parseLevel(line) {
      if (line.includes('[ERROR]')) return 'ERROR';
      if (line.includes('[WARN]')) return 'WARN';
      if (line.includes('[AUDIT]')) return 'AUDIT';
      if (line.includes('[INFO]')) return 'INFO';
      if (line.includes('[DEBUG]')) return 'DEBUG';
      if (line.includes('[TRACE]')) return 'TRACE';
      return 'UNKNOWN';
    }

    function parseSource(line) {
      const m = line.match(/\]\s+(\w+\.\w+:\d+)/);
      return m ? m[1] : '';
    }

    function parseMessage(line) {
      const m = line.match(/\]\s+\w+\.\w+:\d+\s+(.+)$/);
      return m ? m[1] : line;
    }

    function fmtTime(date) {
      return fmtTimeWithTz(date, false);
    }

    function fmtDate(date) {
      return fmtTimeWithTz(date, true);
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // === PLAIN ENGLISH TRANSLATIONS ===
    function translateToPlainEnglish(msg, level, src) {
      const m = msg.toLowerCase();
      
      // Check location-specific patterns first
      const locTranslation = checkLocationPatterns(msg, level);
      if (locTranslation) return { ...locTranslation, severity: level === 'ERROR' ? 'critical' : level === 'WARN' ? 'warning' : 'info' };
      
      // Watchdog / Freezing
      if (m.includes('main_watchdog hit')) 
        return { text: "⚠️ The app froze or became unresponsive", action: "Ask user if app felt slow/frozen. May need to restart the app.", severity: "critical" };
      
      // Helper / Extension
      if (m.includes('helper died') || m.includes('helper crash'))
        return { text: "🔌 The browser extension crashed", action: "Ask user to reinstall the browser extension and restart their browser.", severity: "critical" };
      
      // Memory
      if (m.includes('os memory') || m.includes('low memory'))
        return { text: "💾 Computer is running low on memory (RAM)", action: "User may have too many apps open. Suggest closing unused programs.", severity: "warning" };
      
      // Screenshots
      if (m.includes('uploading screen'))
        return { text: "📸 Screenshot data is uploading — does not confirm the image is valid (may be blank if permissions are missing)", action: null, severity: "info" };
      if (m.includes('capture screen'))
        return { text: "📸 Screenshot capture initiated — actual image quality depends on screen recording permissions", action: null, severity: "info" };
      if (m.includes('screenshot') && (m.includes('fail') || m.includes('error')))
        return { text: "📸 Screenshot failed to capture or upload", action: "Check user's internet connection and screen capture permissions. On macOS: System Settings → Privacy & Security → Screen Recording.", severity: "warning" };
      if (m.includes('wrote screendata'))
        return { text: "📸 Screenshot data written locally — upload pending", action: null, severity: "info" };
      
      // Network errors
      if (m.includes('response: 401') || m.includes('response: 403'))
        return { text: "🔐 Authentication failed - user may be logged out", action: "Ask user to log out and log back into Hubstaff.", severity: "critical" };
      if (m.includes('response: 404'))
        return { text: "❓ Server couldn't find the requested data", action: "The project or task may have been deleted. Check if it still exists.", severity: "warning" };
      if (m.includes('response: 500') || m.includes('response: 502') || m.includes('response: 503'))
        return { text: "🌐 Hubstaff server error occurred", action: "This is a server-side issue. Check status.hubstaff.com for outages.", severity: "critical" };
      if (m.includes('server error'))
        return { text: "🌐 Couldn't connect to Hubstaff servers", action: "Check user's internet. If working, check status.hubstaff.com.", severity: "warning" };
      if (m.includes('traffic issue') || m.includes('network error'))
        return { text: "🌐 Network connection problem", action: "User may have unstable internet. Ask about WiFi/connection quality.", severity: "warning" };
      if (m.includes('timeout'))
        return { text: "⏱️ Request timed out - server took too long", action: "Usually temporary. If persistent, check internet speed.", severity: "warning" };
      
      // Time tracking
      if (m.includes('discard=1') || m.includes('discard=true')) {
        if (m.includes('locked')) return { text: "🔒 Time rejected - timesheet is locked/approved", action: "Admin has locked this timesheet. Time cannot be added.", severity: "critical" };
        if (m.includes('future')) return { text: "⏰ Time rejected - computer clock is wrong", action: "User's computer clock is set to the future. Fix system time.", severity: "critical" };
        if (m.includes('duplicate')) return { text: "📋 Time rejected - already recorded", action: "This time was already uploaded. No action needed.", severity: "info" };
        return { text: "❌ Tracked time was rejected by the server", action: "Check the specific reason. May need manual time entry.", severity: "critical" };
      }
      if (m.includes('resume_ignored'))
        return { text: "⏭️ Resume time was auto-discarded by policy", action: "User should open app periodically to confirm timer is intentional.", severity: "warning" };
      if (m.includes('resume_cancelled'))
        return { text: "❌ User chose not to keep resumed time", action: null, severity: "info" };
      if (m.includes('resume_detected'))
        return { text: "🔄 Timer was left running when app closed - recovering time", action: null, severity: "info" };
      if (m.includes('start_ignored'))
        return { text: "🚫 Timer start was blocked by a policy", action: "Check organization policies - may be location restriction, limit, or schedule.", severity: "warning" };
      if (m.includes('tracking_stopped'))
        return { text: "⏹️ Tracking was stopped by the system", action: "Check logs for specific reason (limit reached, policy, error).", severity: "warning" };
      if (m.includes('resume') && !m.includes('resume_ignored'))
        return { text: "▶️ Tracking resumed after interruption", action: null, severity: "info" };
      if (m.includes('idle') && m.includes('wake'))
        return { text: "💤 User returned from being idle", action: null, severity: "info" };
      if (m.includes('idle') && !m.includes('wake'))
        return { text: "💤 User went idle (no activity detected)", action: null, severity: "info" };
      
      // Startup
      if (m.includes('startup') && m.includes('clean'))
        return { text: "✅ App started normally", action: null, severity: "success" };
      if (m.includes('startup') && m.includes('unclean'))
        return { text: "⚠️ App restarted after a crash", action: "Check if time was recovered. Look for RESUME events after this.", severity: "warning" };
      
      // Location / Job Sites
      if (m.includes('locationmanager') || m.includes('locationfeature'))
        return { text: "📍 Location/Job Site feature activity", action: null, severity: "info" };
      if (m.includes('geofence') && m.includes('enter'))
        return { text: "📍 User entered a Job Site location", action: null, severity: "info" };
      if (m.includes('geofence') && m.includes('exit'))
        return { text: "📍 User left a Job Site location", action: "If tracking stopped unexpectedly, this may be why.", severity: "info" };
      if (m.includes('location') && m.includes('denied'))
        return { text: "📍 Location permission was denied", action: "User needs to enable location permissions for Job Sites to work.", severity: "warning" };
      
      // URLs and Apps
      if (m.includes('url:') && m.includes('title:'))
        return { text: "🖥️ Recorded active window/website", action: null, severity: "info" };
      if (m.includes('applicationgrabber'))
        return { text: "🖥️ Detecting active application", action: null, severity: "info" };
      
      // Generic errors/warnings
      if (level === 'ERROR')
        return { text: "❌ An error occurred in the app", action: "Review the technical details below for more context.", severity: "critical" };
      if (level === 'WARN')
        return { text: "⚠️ Something unexpected happened", action: "Usually not critical, but worth noting if issues persist.", severity: "warning" };
      
      return null;
    }

