    // === SILENT APP HEALTH DASHBOARD ===
    function calculateSilentAppHealth(sa, data) {
      let score = 100;
      const checks = [];
      const LATEST_VERSION = '1.7.10';

      // 1. Version check (-20 if outdated)
      if (sa.version) {
        const versionNum = sa.version.split('-')[0]; // strip hash
        const compareVersions = (a, b) => {
          const pa = a.split('.').map(Number);
          const pb = b.split('.').map(Number);
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0, nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
          }
          return 0;
        };
        const isLatest = compareVersions(versionNum, LATEST_VERSION) >= 0;
        if (!isLatest) {
          score -= 20;
          checks.push({ status: 'fail', label: 'Version Outdated', detail: `Running ${sa.version} — latest is ${LATEST_VERSION}. Update recommended.`, icon: '📦', tooltip: 'The silent app version controls how the app tracks time, handles restarts, and recovers from sleep. Older versions have known bugs — for example, v1.7.9 had an issue where the app would stop tracking after the PC went to sleep and fail to resume, which Sergey fixed in v1.7.10. Always recommend updating to the latest version as the first troubleshooting step.' });
        } else {
          checks.push({ status: 'pass', label: 'Version Current', detail: `Running ${sa.version}`, icon: '📦', tooltip: 'This silent app is running the latest known version. Version-related bugs are unlikely to be the cause of any issues. If problems persist, focus on other factors like network, system resources, or OS behaviour.' });
        }
      } else {
        score -= 5;
        checks.push({ status: 'warn', label: 'Version Unknown', detail: 'Could not extract version from logs', icon: '📦', tooltip: 'The version could not be found in the uploaded logs. To get version info, make sure you include the hubstaff.log or helper_hubstaff.log files — these contain the "Client Version" or "Running Current Version" line on startup.' });
      }

      // 2. Auth check (-25 if provision failures)
      const provisionFails = sa.authEvents.filter(a => a.type === 'PROVISION_FAIL').length;
      const tokenAuths = sa.authEvents.filter(a => a.type === 'TOKEN').length;
      const offlineAuths = sa.authEvents.filter(a => a.type === 'OFFLINE').length;
      if (provisionFails > 0) {
        score -= 25;
        checks.push({ status: 'fail', label: 'Provisioning Failed', detail: `${provisionFails} CORPORATE_PROVISION_ATTEMPT_FAILED event(s). App may fail to track.`, icon: '🔐', tooltip: 'CORPORATE_PROVISION_ATTEMPT_FAILED means the silent app tried to set up the account but couldn\'t. The app won\'t be able to track time until this is resolved. Common causes: the enterprise profile is corrupted, the user\'s email was changed in Hubstaff, or there\'s a network issue blocking the auth server. Try reinstalling the enterprise profile or re-provisioning the user.' });
      } else if (tokenAuths > 0) {
        checks.push({ status: 'pass', label: 'Authentication OK', detail: `${tokenAuths} successful token auth(s), ${offlineAuths} offline auth(s)`, icon: '🔐', tooltip: 'The app authenticated successfully using tokens from the Hubstaff server. Offline auth happens on startup before the network connection is established — this is normal. As long as token auth succeeds afterwards, authentication is working correctly.' });
      } else if (offlineAuths > 0) {
        score -= 5;
        checks.push({ status: 'warn', label: 'Offline Auth Only', detail: `${offlineAuths} offline auth(s) but no token auth — check network`, icon: '🔐', tooltip: 'The app only authenticated using cached offline credentials and never successfully verified with the Hubstaff server. This could mean the PC has no internet access, a firewall is blocking Hubstaff, or there\'s a proxy configuration issue. The app may still track, but data might not sync until a connection is restored.' });
      }

      // 3. Startup gaps (-15 per multi-day gap)
      const sortedStartups = [...sa.startups].sort((a, b) => a.ts - b.ts);
      const sortedShutdowns = [...sa.shutdowns].sort((a, b) => a.ts - b.ts);
      let multiDayGaps = [];
      for (let i = 0; i < sortedShutdowns.length; i++) {
        const shutdownTs = sortedShutdowns[i].ts;
        // Find next startup after this shutdown
        const nextStartup = sortedStartups.find(s => s.ts > shutdownTs);
        if (nextStartup) {
          const gapMs = nextStartup.ts - shutdownTs;
          const gapHours = gapMs / 3600000;
          if (gapHours > 24) {
            multiDayGaps.push({
              shutdownTs,
              startupTs: nextStartup.ts,
              gapHours: Math.round(gapHours * 10) / 10,
              gapDays: Math.round(gapHours / 24 * 10) / 10
            });
          }
        }
      }
      if (multiDayGaps.length > 0) {
        const maxGap = Math.max(...multiDayGaps.map(g => g.gapDays));
        const penalty = Math.min(30, multiDayGaps.length * 15);
        score -= penalty;
        checks.push({ status: 'fail', label: `${multiDayGaps.length} Multi-Day Gap(s)`, detail: `App was offline for extended periods. Longest: ${maxGap} days. Total gaps: ${multiDayGaps.length}`, icon: '⏸️', tooltip: 'The app was completely offline for over 24 hours between a shutdown and the next startup. During these gaps, NO time was tracked. This is the most common silent app complaint — customers say "the user was working but no time was recorded." The app shutdown is often triggered by the PC going to sleep (screen off → no monitors detected → shutdown). If the app doesn\'t restart the next day, it\'s likely a known bug fixed in newer versions, or the PC stayed in sleep/hibernate.' });
      } else {
        checks.push({ status: 'pass', label: 'No Multi-Day Gaps', detail: 'App came back each day after shutdown', icon: '⏸️', tooltip: 'The app restarted within 24 hours after every shutdown — no extended offline periods detected. This means the app\'s auto-restart mechanism is working correctly and tracking should be consistent day-to-day.' });
      }

      // 4. Unclean startups (-5 per, max -15)
      const uncleanCount = sa.startups.filter(s => s.type === 'UNCLEAN').length;
      if (uncleanCount > 0) {
        const penalty = Math.min(15, uncleanCount * 5);
        score -= penalty;
        checks.push({ status: uncleanCount > 3 ? 'fail' : 'warn', label: `${uncleanCount} Crash(es)`, detail: `${uncleanCount} STARTUP_UNCLEAN — app crashed or was force-killed`, icon: '💥', tooltip: 'STARTUP_UNCLEAN means the app didn\'t shut down properly before this startup. It was either: crashed by a bug, killed by the OS (memory pressure, updates, antivirus), force-closed by the user, or lost power. Occasional crashes (1-2) are normal, but frequent crashes suggest a deeper issue — check system memory, antivirus exclusions, and whether the app is up to date. A "double-start" pattern (crash → immediate restart) is actually a good sign, as it means the app auto-recovered.' });
      } else {
        checks.push({ status: 'pass', label: 'No Crashes', detail: 'All startups were clean', icon: '💥', tooltip: 'Every startup in the logs was STARTUP_CLEAN, meaning the app always shut down properly before restarting. This rules out crashes, force-closes, and system kills as a cause of any tracking issues.' });
      }

      // 5. Helper died (-5 if >10, -10 if >50)
      if (sa.helperDied > 50) {
        score -= 10;
        checks.push({ status: 'fail', label: `Helper Crashed ${sa.helperDied}×`, detail: 'Excessive helper process crashes — may affect app detection and screenshots', icon: '🔧', tooltip: 'The helper process is a separate component that captures screenshots, detects active applications, and grabs URLs. When it crashes ("Helper died"), the main app restarts it automatically. However, excessive crashes (50+) mean screenshots may be missing, app tracking could be incomplete, and URL detection might have gaps. Common causes: antivirus blocking the helper, screen capture permissions issues, or conflicts with other monitoring software.' });
      } else if (sa.helperDied > 10) {
        score -= 5;
        checks.push({ status: 'warn', label: `Helper Crashed ${sa.helperDied}×`, detail: 'Elevated helper crashes — monitor for screenshot/app detection issues', icon: '🔧', tooltip: 'The helper crash count is elevated but not critical. The main app auto-restarts the helper after each crash, so most functionality recovers quickly. Keep an eye on whether screenshots are being captured consistently. If the count keeps rising, check for antivirus interference or screen capture permission issues.' });
      } else if (sa.helperDied > 0) {
        checks.push({ status: 'pass', label: `Helper Crashed ${sa.helperDied}×`, detail: 'Low count — within normal range', icon: '🔧', tooltip: 'A small number of helper crashes is normal — the helper process occasionally restarts due to application focus changes or temporary access issues. The main app handles this gracefully by auto-restarting the helper. No action needed.' });
      } else {
        checks.push({ status: 'pass', label: 'Helper Stable', detail: 'No helper process crashes detected', icon: '🔧', tooltip: 'The helper process ran without any crashes. Screenshots, app detection, and URL tracking should all be working reliably.' });
      }

      // 6. Screen sleep shutdowns
      if (sa.captureDesktop.length > 0) {
        // Not penalized but flagged - this is how silent app shuts down normally
        checks.push({ status: sa.captureDesktop.length > 10 ? 'warn' : 'pass', label: `${sa.captureDesktop.length} Screen Sleep(s)`, detail: 'PC went to sleep/hibernate, triggering shutdown. This is expected for end-of-day.', icon: '🖥️', tooltip: '"No monitors detected" means the PC screen turned off — either the user locked their PC, it went to sleep/hibernate, or the monitor powered down from inactivity. The silent app detects this and stops tracking with RESUME_LATER, then shuts down. This is normal end-of-day behaviour. The app should restart automatically the next time the PC wakes up. If it doesn\'t restart, that\'s when you get multi-day gaps.' });
      }

      // 7. Stop errors
      if (sa.stopErrors.length > 0) {
        score -= 10;
        checks.push({ status: 'fail', label: `${sa.stopErrors.length} Stop Error(s)`, detail: 'Tracking stopped due to errors — potential data loss', icon: '🛑', tooltip: 'STOP_ERROR means tracking was forcibly stopped due to an internal error. Any unsynced activity data from that session may have been lost. This is different from a normal stop or idle timeout — it indicates something went wrong inside the app. Check the error logs for more detail. If this happens repeatedly, updating the app or reinstalling may be needed.' });
      }

      // 8. Resume handling
      const resumeIgnored = sa.resumes.filter(r => r.type === 'IGNORED').length;
      const longResumes = sa.resumes.filter(r => {
        if (r.type !== 'DETECTED' || !r.duration) return false;
        const parts = r.duration.split(':').map(Number);
        const hours = parts[0] || 0;
        return hours > 24;
      });
      if (longResumes.length > 0) {
        score -= 10;
        const maxDuration = longResumes.reduce((max, r) => {
          return r.duration > max ? r.duration : max;
        }, '0:00:00');
        checks.push({ status: 'fail', label: `${longResumes.length} Long Resume Gap(s)`, detail: `App detected resume after extended downtime (longest: ${maxDuration}). Time was discarded.`, icon: '⏰', tooltip: 'When the silent app starts up, it checks how long ago it last tracked. If the gap exceeds the resume threshold (configured by the org — typically "keep: 6h / discard: 6h"), it discards the gap and starts fresh. RESUME_IGNORED means the gap was too long to auto-resume. This is by design — the silent app won\'t claim time it can\'t verify. The real question is: why was the app offline so long? Look at the shutdown before this resume to understand what caused the gap.' });
      }

      // 9. System memory
      if (sa.systemMem) {
        const usedGB = sa.systemMem.usedBytes / (1024 * 1024 * 1024);
        const totalGB = sa.systemMem.totalBytes / (1024 * 1024 * 1024);
        const usedPct = (sa.systemMem.usedBytes / sa.systemMem.totalBytes * 100).toFixed(0);
        if (parseInt(usedPct) > 90) {
          score -= 10;
          checks.push({ status: 'fail', label: 'Memory Critical', detail: `${usedPct}% used (${usedGB.toFixed(1)}GB / ${totalGB.toFixed(1)}GB) — may cause crashes`, icon: '💾', tooltip: 'System memory usage is dangerously high. When RAM is nearly full, Windows starts aggressively killing background processes to free memory — the silent app is a prime target since it runs invisibly. This can cause STARTUP_UNCLEAN events, missed tracking, and the app failing to restart after sleep. Recommend the user close unnecessary applications or consider a RAM upgrade.' });
        } else if (parseInt(usedPct) > 75) {
          score -= 5;
          checks.push({ status: 'warn', label: 'Memory Elevated', detail: `${usedPct}% used (${usedGB.toFixed(1)}GB / ${totalGB.toFixed(1)}GB)`, icon: '💾', tooltip: 'Memory usage is elevated. While not immediately critical, sustained high memory usage increases the risk of the OS terminating background processes like the silent app. If the user runs memory-heavy applications (Chrome with many tabs, CAD software, video editing), this could explain intermittent tracking gaps.' });
        } else {
          checks.push({ status: 'pass', label: 'Memory OK', detail: `${usedPct}% used (${usedGB.toFixed(1)}GB / ${totalGB.toFixed(1)}GB)`, icon: '💾', tooltip: 'System memory is within a healthy range. Memory pressure is unlikely to be causing any silent app issues. The OS should have no reason to kill the app for resource reclamation.' });
        }
      }

      // Phase 3: Double-starts
      if (sa.doubleStarts.length > 0) {
        score -= Math.min(10, sa.doubleStarts.length * 3);
        checks.push({ status: sa.doubleStarts.length > 3 ? 'fail' : 'warn', label: `${sa.doubleStarts.length} Double-Start(s)`, detail: `Back-to-back START_TRACKING without a STOP in between — indicates crash-restart cycles`, icon: '⚡', tooltip: 'A "double-start" happens when a new START_TRACKING fires without the previous session being properly stopped. This usually means the app crashed mid-session and auto-restarted. The previous session\'s data may be incomplete. Occasional double-starts are OK (shows auto-recovery), but frequent ones indicate instability.' });
      }

      // Phase 3: Resume threshold config
      if (sa.resumeThreshold) {
        checks.push({ status: 'pass', label: 'Resume Config', detail: `Keep: ${sa.resumeThreshold.keep} / Discard: ${sa.resumeThreshold.discard}`, icon: '⚙️', tooltip: `The resume threshold controls how the app handles gaps after a restart. If the gap is shorter than the "keep" value (${sa.resumeThreshold.keep}), the time is automatically resumed. If it exceeds the "discard" value (${sa.resumeThreshold.discard}), the gap is discarded and tracking starts fresh. These values are set by the organization admin. Shorter thresholds mean gaps are discarded more aggressively.` });
      }

      // Phase 4: SSL errors
      if (sa.sslErrors.length > 0) {
        score -= Math.min(10, sa.sslErrors.length * 2);
        checks.push({ status: sa.sslErrors.length > 5 ? 'fail' : 'warn', label: `${sa.sslErrors.length} SSL Error(s)`, detail: 'SSL/TLS connection errors detected — may affect data sync', icon: '🔒', tooltip: 'SSL errors mean the app couldn\'t establish a secure connection to Hubstaff servers. Causes include: corporate proxy/firewall intercepting HTTPS, outdated Windows root certificates, antivirus performing SSL inspection, or network instability. Data tracked locally should sync when the connection is restored, but persistent SSL issues can cause delayed or missing data on the dashboard.' });
      }

      // Phase 4: HTTP 429 rate limiting
      if (sa.http429s.length > 0) {
        score -= Math.min(15, sa.http429s.length > 20 ? 15 : 5);
        checks.push({ status: sa.http429s.length > 20 ? 'fail' : 'warn', label: `${sa.http429s.length} Rate Limit(s)`, detail: 'HTTP 429 "Too Many Requests" — server throttling the app', icon: '🚦', tooltip: 'HTTP 429 means the Hubstaff server is rejecting requests because the app is sending too many too fast. This typically affects the /screens endpoint (screenshot uploads). When rate-limited, screenshots may be delayed or missing. This is usually temporary and resolves itself. If persistent, it could indicate a bug in the app version causing excessive API calls.' });
      }

      // Phase 4: PENDING_DETECTED
      if (sa.pendingDetected.length > 0) {
        checks.push({ status: 'warn', label: `${sa.pendingDetected.length} Pending Event(s)`, detail: 'Unsent data detected on startup — previous session had sync issues', icon: '📤', tooltip: 'PENDING_DETECTED means the app found data from a previous session that hadn\'t been uploaded to the server yet. The app will attempt to sync this data. If this happens frequently, it suggests the network connection is unreliable or the app is being shut down before it can finish uploading.' });
      }

      // Screenshot Health Check
      if (data && data.screenshotHealth) {
        const sh = data.screenshotHealth;
        if (sh.blankRiskFactors.length > 0) {
          const hasCritical = sh.blankRiskFactors.some(r => r.severity === 'critical');
          const reasons = sh.blankRiskFactors.map(r => r.reason).join(', ');
          score -= hasCritical ? 15 : 5;
          checks.push({ status: hasCritical ? 'fail' : 'warn', label: `Screenshot Blank Risk`, detail: `${sh.blankRiskFactors.length} factor(s): ${reasons}`, icon: '📸', tooltip: 'Screenshots appear to be uploading, but conditions exist that commonly cause blank or black screenshots. Check the Activity page in Hubstaff dashboard to verify screenshots aren\'t blank. Common causes: missing screen recording permission on macOS, antivirus/web-shield software (McAfee, Norton, Webroot), VirtualBox, or the computer going to sleep during tracking. See the "Screenshots & Screen Capture" section for full details and resolution steps.' });
        } else if (data.screenshots.length > 0) {
          checks.push({ status: 'pass', label: 'Screenshots Healthy', detail: `${data.screenshots.length} screenshot events, no blank risk factors`, icon: '📸', tooltip: 'Screenshot capture and upload events look healthy. No conditions detected that would typically cause blank or black screenshots. If the user still reports blank screenshots, check: (1) macOS screen recording permission, (2) antivirus software, (3) whether the computer sleeps during tracking.' });
        }
      }

      score = Math.max(0, Math.min(100, score));
      return { score, checks, multiDayGaps };
    }

    // === SILENT APP LIFECYCLE TIMELINE ===
    function buildLifecycleCycles(sa, data) {
      // Build cycles: each cycle = one startup → shutdown period
      // Sort all events chronologically
      const events = [];

      sa.startups.forEach(s => events.push({ ts: s.ts, type: 'startup', subtype: s.type }));
      sa.shutdowns.forEach(s => events.push({ ts: s.ts, type: 'shutdown' }));
      sa.resumes.forEach(r => events.push({ ts: r.ts, type: 'resume', subtype: r.type, duration: r.duration, startTime: r.startTime }));
      sa.captureDesktop.forEach(c => events.push({ ts: c.ts, type: 'screen_sleep' }));
      sa.authEvents.forEach(a => events.push({ ts: a.ts, type: 'auth', subtype: a.type, user: a.user, userId: a.userId }));
      sa.stopErrors.forEach(e => events.push({ ts: e.ts, type: 'stop_error' }));

      // Also pull tracking sessions for this timeline
      data.sessions.forEach(s => {
        events.push({ ts: s.start, type: 'track_start', reason: s.startReason });
        if (s.stop) events.push({ ts: s.stop, type: 'track_stop', reason: s.stopReason, duration: s.duration });
      });

      events.sort((a, b) => (a.ts || 0) - (b.ts || 0));

      // Group into cycles (startup → shutdown)
      const cycles = [];
      let currentCycle = null;

      for (const ev of events) {
        if (ev.type === 'startup') {
          if (currentCycle && !currentCycle.shutdownTs) {
            // Previous cycle had no shutdown - it crashed
            currentCycle.shutdownTs = ev.ts;
            currentCycle.shutdownReason = 'CRASHED';
            currentCycle.uptime = currentCycle.shutdownTs - currentCycle.startupTs;
            cycles.push(currentCycle);
          }
          currentCycle = {
            startupTs: ev.ts,
            startupType: ev.subtype, // CLEAN or UNCLEAN
            shutdownTs: null,
            shutdownReason: null,
            uptime: 0,
            events: [],
            trackingSessions: [],
            totalTrackedSecs: 0,
            hadScreenSleep: false,
            hadResume: false,
            resumeDuration: null,
            resumeType: null,
            authOk: false,
            authFailed: false
          };
          currentCycle.events.push(ev);
        } else if (currentCycle) {
          currentCycle.events.push(ev);

          if (ev.type === 'shutdown') {
            currentCycle.shutdownTs = ev.ts;
            currentCycle.shutdownReason = 'CLEAN';
            currentCycle.uptime = ev.ts - currentCycle.startupTs;
            cycles.push(currentCycle);
            currentCycle = null;
          } else if (ev.type === 'screen_sleep') {
            currentCycle.hadScreenSleep = true;
          } else if (ev.type === 'resume') {
            currentCycle.hadResume = true;
            currentCycle.resumeType = ev.subtype;
            currentCycle.resumeDuration = ev.duration;
          } else if (ev.type === 'auth') {
            if (ev.subtype === 'TOKEN') currentCycle.authOk = true;
            if (ev.subtype === 'PROVISION_FAIL') currentCycle.authFailed = true;
          } else if (ev.type === 'track_start') {
            currentCycle.trackingSessions.push({ start: ev.ts, reason: ev.reason });
          } else if (ev.type === 'track_stop') {
            const lastSession = currentCycle.trackingSessions[currentCycle.trackingSessions.length - 1];
            if (lastSession && !lastSession.stop) {
              lastSession.stop = ev.ts;
              lastSession.stopReason = ev.reason;
              lastSession.duration = ev.duration || 0;
              currentCycle.totalTrackedSecs += lastSession.duration;
            }
          } else if (ev.type === 'stop_error') {
            currentCycle.hadStopError = true;
          }
        }
      }

      // Handle last cycle if it never got a shutdown
      if (currentCycle) {
        currentCycle.shutdownReason = 'RUNNING';
        currentCycle.uptime = (data.endTime || Date.now()) - currentCycle.startupTs;
        cycles.push(currentCycle);
      }

      // Calculate gaps between cycles
      for (let i = 0; i < cycles.length - 1; i++) {
        const curr = cycles[i];
        const next = cycles[i + 1];
        if (curr.shutdownTs && next.startupTs) {
          const gapMs = next.startupTs - curr.shutdownTs;
          curr.gapAfterMs = gapMs;
          curr.gapAfterHours = gapMs / 3600000;
        }
      }

      return cycles;
    }

    function renderLifecycleTimeline(cycles) {
      if (cycles.length === 0) return '';

      const fmtTime12 = (ts) => {
        if (!ts) return '--';
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      };

      const fmtDateShort = (ts) => {
        if (!ts) return '--';
        const d = new Date(ts);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      const fmtDurShort = (secs) => {
        if (!secs || secs <= 0) return '0m';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      };

      // Start collapsed
      let html = `
        <div class="sa-lifecycle">
          <div class="sa-lifecycle-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
            <h4>📅 App Lifecycle Timeline (${cycles.length} cycles)</h4>
            <span class="sa-lc-toggle">▼</span>
          </div>
          <div class="sa-lifecycle-body collapsed">
      `;

      for (let i = 0; i < cycles.length; i++) {
        const c = cycles[i];
        const cycleId = 'sa-cycle-' + i;
        const dateStr = fmtDateShort(c.startupTs);
        const uptimeStr = c.uptime ? fmtDurShort(c.uptime / 1000) : '--';
        const trackedStr = fmtDurShort(c.totalTrackedSecs);

        // Tags
        let tags = '';
        if (c.startupType === 'UNCLEAN') tags += '<span class="sa-cycle-tag crash">CRASHED START</span>';
        if (c.hadScreenSleep) tags += '<span class="sa-cycle-tag sleep">SCREEN SLEEP</span>';
        if (c.shutdownReason === 'CRASHED') tags += '<span class="sa-cycle-tag crash">NO SHUTDOWN</span>';
        if (c.shutdownReason === 'RUNNING') tags += '<span class="sa-cycle-tag clean">STILL RUNNING</span>';
        if (c.hadResume && c.resumeType === 'IGNORED') tags += '<span class="sa-cycle-tag gap">RESUME IGNORED</span>';
        if (c.hadResume && c.resumeType === 'TRACKING') tags += '<span class="sa-cycle-tag resumed">RESUMED</span>';
        if (c.authFailed) tags += '<span class="sa-cycle-tag crash">AUTH FAILED</span>';
        if (c.hadStopError) tags += '<span class="sa-cycle-tag crash">STOP ERROR</span>';

        // Build table rows for events
        const keyEvents = c.events.filter(e =>
          e.type === 'startup' || e.type === 'shutdown' || e.type === 'resume' ||
          e.type === 'screen_sleep' || e.type === 'auth' || e.type === 'track_start' ||
          e.type === 'track_stop' || e.type === 'stop_error'
        );

        let rowsHtml = '';
        for (const ev of keyEvents) {
          const time = fmtTime12(ev.ts);
          let badge, badgeCls, detail, rowCls = '';

          switch (ev.type) {
            case 'startup':
              badge = ev.subtype === 'CLEAN' ? 'STARTUP CLEAN' : 'STARTUP UNCLEAN';
              badgeCls = ev.subtype === 'CLEAN' ? 'startup' : 'error';
              detail = ev.subtype === 'CLEAN' ? 'App started normally after clean shutdown' : 'App started after crash or force-kill';
              break;
            case 'shutdown':
              badge = 'SHUTDOWN';
              badgeCls = 'shutdown';
              detail = 'App shut down cleanly';
              break;
            case 'resume':
              if (ev.subtype === 'DETECTED') {
                badge = 'RESUME DETECTED';
                badgeCls = 'resume';
                detail = `Gap since last tracking: ${ev.duration || '?'}`;
              } else if (ev.subtype === 'IGNORED') {
                badge = 'RESUME IGNORED';
                badgeCls = 'error';
                detail = 'Gap exceeded threshold — time discarded, fresh start';
                rowCls = 'sa-ev-highlight';
              } else if (ev.subtype === 'NEEDS_CONFIRM') {
                badge = 'RESUME PENDING';
                badgeCls = 'resume';
                detail = 'Resume needs schedule/policy confirmation';
              } else if (ev.subtype === 'TRACKING') {
                badge = 'RESUMED';
                badgeCls = 'tracking';
                detail = 'Tracking resumed — gap time kept';
              } else {
                badge = 'RESUME'; badgeCls = 'resume'; detail = ev.subtype;
              }
              break;
            case 'screen_sleep':
              badge = 'SCREEN SLEEP';
              badgeCls = 'sleep';
              detail = 'No monitors detected — PC went to sleep/hibernate';
              rowCls = 'sa-ev-highlight';
              break;
            case 'auth':
              if (ev.subtype === 'TOKEN') {
                badge = 'AUTH OK'; badgeCls = 'auth';
                const authEmail = ev.user ? ev.user.replace(/PII->/, '') : '';
                const authId = ev.userId ? ` (ID: ${ev.userId})` : '';
                detail = 'Authenticated via server token' + (authEmail ? ` — ${authEmail}${authId}` : '');
                rowCls = 'sa-ev-dim';
              } else if (ev.subtype === 'OFFLINE') {
                badge = 'AUTH OFFLINE'; badgeCls = 'auth'; detail = 'Using cached credentials'; rowCls = 'sa-ev-dim';
              } else if (ev.subtype === 'PROVISION_FAIL') {
                badge = 'AUTH FAILED'; badgeCls = 'error'; detail = 'Corporate provisioning failed — app cannot track';
                rowCls = 'sa-ev-highlight';
              } else {
                badge = 'AUTH'; badgeCls = 'auth'; detail = ev.subtype; rowCls = 'sa-ev-dim';
              }
              break;
            case 'track_start':
              badge = 'START TRACKING';
              badgeCls = 'tracking';
              detail = `Started by ${ev.reason || 'unknown'}`;
              rowCls = 'sa-ev-dim';
              break;
            case 'track_stop':
              badge = 'STOP TRACKING';
              badgeCls = 'tracking';
              detail = `Stopped by ${ev.reason || 'unknown'}`;
              rowCls = ev.reason === 'CRASHED' || ev.reason === 'ERROR' ? 'sa-ev-highlight' : 'sa-ev-dim';
              break;
            case 'stop_error':
              badge = 'STOP ERROR';
              badgeCls = 'error';
              detail = 'Tracking stopped due to internal error';
              rowCls = 'sa-ev-highlight';
              break;
            default:
              badge = ev.type; badgeCls = 'auth'; detail = ''; rowCls = 'sa-ev-dim';
          }

          rowsHtml += `<tr class="${rowCls}">
            <td style="font-family:monospace; font-size:10px; white-space:nowrap; color:var(--muted); width:80px;">${time}</td>
            <td style="width:140px;"><span class="sa-ev-badge ${badgeCls}">${badge}</span></td>
            <td>${detail}</td>
          </tr>`;
        }

        html += `
          <div class="sa-cycle">
            <div class="sa-cycle-header" onclick="var el=document.getElementById('${cycleId}'); el.classList.toggle('open');">
              <span class="sa-cycle-date">${dateStr}</span>
              <span class="sa-cycle-uptime">⏱ Up: ${uptimeStr}</span>
              <span class="sa-cycle-tracked">🎯 Tracked: ${trackedStr}</span>
              <span class="sa-cycle-tags">${tags}</span>
            </div>
            <div class="sa-cycle-events" id="${cycleId}">
              <table>
                <thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;

        // Show gap between cycles
        if (c.gapAfterMs && c.gapAfterHours > 1) {
          const gapDays = (c.gapAfterHours / 24).toFixed(1);
          const isMultiDay = c.gapAfterHours > 24;
          if (isMultiDay) {
            html += `<div class="sa-gap-row" style="font-weight:700;">
              <span>🚨</span>
              <span>GAP: ${gapDays} days (${c.gapAfterHours.toFixed(1)}h) — app was OFFLINE</span>
            </div>`;
          } else {
            html += `<div class="sa-overnight-row">
              <span>🌙</span>
              <span>Overnight: ${c.gapAfterHours.toFixed(1)}h gap</span>
            </div>`;
          }
        }
      }

      html += `</div></div>`;
      return html;
    }

    function renderSilentAppDashboard(sa, data) {
      const container = $('silentAppDashboard');
      if (!sa.detected) {
        container.style.display = 'none';
        return;
      }

      const health = calculateSilentAppHealth(sa, data);
      const score = health.score;

      // Health bar color
      let barColor, scoreLabel, scoreCls;
      if (score >= 80) {
        barColor = 'linear-gradient(90deg, #22c55e, #4ade80)';
        scoreLabel = 'Healthy';
        scoreCls = 'success';
      } else if (score >= 60) {
        barColor = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
        scoreLabel = 'Needs Attention';
        scoreCls = 'warn';
      } else if (score >= 40) {
        barColor = 'linear-gradient(90deg, #f97316, #fb923c)';
        scoreLabel = 'Degraded';
        scoreCls = 'warn';
      } else {
        barColor = 'linear-gradient(90deg, #ef4444, #f87171)';
        scoreLabel = 'Critical';
        scoreCls = 'danger';
      }

      // Version badge
      const LATEST_VERSION = '1.7.10';
      let versionBadge = '';
      if (sa.version) {
        const versionNum = sa.version.split('-')[0];
        const compareVer = (a, b) => {
          const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
          for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0, nb = pb[i] || 0;
            if (na > nb) return 1; if (na < nb) return -1;
          }
          return 0;
        };
        const isLatest = compareVer(versionNum, LATEST_VERSION) >= 0;
        versionBadge = `<span class="sa-version-badge ${isLatest ? 'current' : 'outdated'}">${isLatest ? '✓' : '⚠'} v${sa.version}</span>`;
      } else {
        versionBadge = '<span class="sa-version-badge unknown">? Version Unknown</span>';
      }

      // KPI values
      const totalStartups = sa.startups.length;
      const cleanStartups = sa.startups.filter(s => s.type === 'CLEAN').length;
      const uncleanStartups = sa.startups.filter(s => s.type === 'UNCLEAN').length;
      const totalShutdowns = sa.shutdowns.length;
      const provisionFails = sa.authEvents.filter(a => a.type === 'PROVISION_FAIL').length;
      const totalGapDays = health.multiDayGaps.reduce((sum, g) => sum + g.gapDays, 0);

      // System memory display
      let memDisplay = '--';
      let memDetail = '';
      if (sa.systemMem) {
        const totalGB = (sa.systemMem.totalBytes / (1024 * 1024 * 1024)).toFixed(0);
        const usedPct = (sa.systemMem.usedBytes / sa.systemMem.totalBytes * 100).toFixed(0);
        memDisplay = `${totalGB}GB`;
        memDetail = `${usedPct}% in use`;
      }

      const html = `
        <div class="silent-app-dashboard">
          <div class="sa-header">
            <h3><span>🏢</span> Silent App Health Dashboard</h3>
            ${versionBadge}
          </div>

          <div class="sa-health-bar-container">
            <div class="sa-health-bar-label">
              <span class="sa-score-text" style="color:var(--${scoreCls})">${score}/100 — ${scoreLabel}</span>
              <span class="sa-score-desc">${sa.corporateUser ? sa.corporateUser : 'Corporate User'}</span>
            </div>
            <div class="sa-health-bar-track">
              <div class="sa-health-bar-fill" style="width:${score}%; background:${barColor};"></div>
            </div>
          </div>

          <div class="sa-kpis">
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Startups</strong>How many times the silent app launched during the log period. "Clean" means it shut down properly last time. "Crashed" (STARTUP_UNCLEAN) means it was killed unexpectedly — by a crash, force-close, or system kill. Frequent crashes suggest instability, possible OS interference, or memory issues.</div>
              <div class="sa-kpi-label">Startups</div>
              <div class="sa-kpi-value">${totalStartups}</div>
              <div class="sa-kpi-detail">${cleanStartups} clean, ${uncleanStartups} crashed</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Shutdowns</strong>How many times the app shut down cleanly. "Screen sleep" shutdowns happen when the PC monitor turns off due to inactivity — the silent app detects no monitors and enters RESUME_LATER mode, then shuts down. This is normal end-of-day behaviour. If shutdowns are much lower than startups, some sessions ended in crashes instead of clean shutdowns.</div>
              <div class="sa-kpi-label">Shutdowns</div>
              <div class="sa-kpi-value">${totalShutdowns}</div>
              <div class="sa-kpi-detail">${sa.captureDesktop.length} from screen sleep</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Multi-Day Gaps</strong>Periods where the silent app was completely offline for more than 24 hours. This is the #1 red flag for silent app issues — if the app shuts down and doesn't restart the next working day, no time gets tracked. Common causes: PC went to sleep/hibernate and didn't wake up, OS killed the app and it didn't auto-restart, or the app needs updating. Check the Extended Offline Periods table below for exact dates.</div>
              <div class="sa-kpi-label">Multi-Day Gaps</div>
              <div class="sa-kpi-value ${health.multiDayGaps.length > 0 ? 'danger' : 'success'}">${health.multiDayGaps.length}</div>
              <div class="sa-kpi-detail">${totalGapDays > 0 ? totalGapDays.toFixed(1) + ' days total offline' : 'No extended gaps'}</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Helper Crashes</strong>The helper process handles app/URL detection and screenshot capture. "Helper died" events mean it crashed and restarted. Some crashes are normal (0-10), but high counts (50+) can cause missed screenshots, inaccurate app tracking, or incomplete activity data. If excessive, try updating the silent app version or checking for conflicting software (antivirus, endpoint protection).</div>
              <div class="sa-kpi-label">Helper Crashes</div>
              <div class="sa-kpi-value ${sa.helperDied > 50 ? 'danger' : sa.helperDied > 10 ? 'warn' : 'success'}">${sa.helperDied}</div>
              <div class="sa-kpi-detail">${sa.helperDied > 50 ? 'Excessive — investigate' : sa.helperDied > 10 ? 'Elevated' : 'Normal range'}</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Authentication Status</strong>The silent app authenticates using an enterprise profile. "Token auth" means it successfully connected to Hubstaff servers and verified the account. "Offline auth" means it used cached credentials (normal after a clean shutdown). CORPORATE_PROVISION_ATTEMPT_FAILED means the app couldn't authenticate at all — it won't track until this is fixed. Check network, enterprise profile, and that the user account is still active.</div>
              <div class="sa-kpi-label">Auth Status</div>
              <div class="sa-kpi-value ${provisionFails > 0 ? 'danger' : 'success'}" style="font-size:14px;">${provisionFails > 0 ? '❌ FAIL' : '✓ OK'}</div>
              <div class="sa-kpi-detail">${provisionFails > 0 ? provisionFails + ' provision failure(s)' : 'Token auth working'}</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>System Memory</strong>Total RAM on the PC and how much is in use. Parsed from the helper_hubstaff.log "Client MEM" line. High memory usage (>90%) can cause the OS to kill background processes like the silent app to free up resources, leading to crashes and missed tracking. If memory is consistently high, the user may need to close unused apps or the PC may need a RAM upgrade.</div>
              <div class="sa-kpi-label">System Memory</div>
              <div class="sa-kpi-value">${memDisplay}</div>
              <div class="sa-kpi-detail">${memDetail || 'Not available in these logs'}</div>
            </div>
            <div class="sa-kpi">
              <div class="sa-tooltip"><strong>Auto-Start/Stop</strong>The silent app uses AUTO_START_STOP to begin tracking when it detects user activity and stop when the user goes idle. "Starts" show how many times auto-tracking kicked in. "No activity" events happen when the idle timeout fires (default 50 min with no input). This is the core mechanism that makes silent tracking work — without it, no time gets recorded.</div>
              <div class="sa-kpi-label">Auto-Track</div>
              <div class="sa-kpi-value">${sa.autoStartStops.filter(a => a.type === 'START').length}</div>
              <div class="sa-kpi-detail">${sa.autoStartStops.filter(a => a.type === 'NO_ACTIVITY').length} idle timeouts</div>
            </div>
            ${sa.http429s.length > 0 ? `<div class="sa-kpi">
              <div class="sa-tooltip"><strong>Rate Limiting</strong>HTTP 429 responses from the Hubstaff API. The server is throttling the app for sending too many requests. This primarily affects screenshot uploads (/screens endpoint). When rate-limited, screenshots may be delayed or missing entirely. Usually temporary, but persistent rate limiting can indicate a bug in the app version.</div>
              <div class="sa-kpi-label">Rate Limits</div>
              <div class="sa-kpi-value warn">${sa.http429s.length}</div>
              <div class="sa-kpi-detail">HTTP 429 responses</div>
            </div>` : ''}
            ${sa.sslErrors.length > 0 ? `<div class="sa-kpi">
              <div class="sa-tooltip"><strong>SSL/TLS Errors</strong>Secure connection failures to Hubstaff servers. Common causes include corporate proxies intercepting HTTPS traffic, expired certificates, antivirus SSL inspection, or network instability. Data may still be tracked locally but won't sync until the connection is restored.</div>
              <div class="sa-kpi-label">SSL Errors</div>
              <div class="sa-kpi-value danger">${sa.sslErrors.length}</div>
              <div class="sa-kpi-detail">Connection failures</div>
            </div>` : ''}
            ${data.screenshots.length > 0 ? `<div class="sa-kpi">
              <div class="sa-tooltip"><strong>Screenshot Health</strong>Tracks whether screenshots are likely to be valid or blank/black. The log shows "Uploading Screen" events, but this only means the app attempted to capture — it does NOT confirm the image contains actual content. Without screen recording permission on macOS, all screenshots will be blank wallpaper. Security software (McAfee, Norton, Webroot) and VirtualBox can also cause blank screenshots on Windows. Check the Activity page in the Hubstaff dashboard to verify screenshots are not blank. See the "Screenshots & Screen Capture" section for detailed risk analysis.</div>
              <div class="sa-kpi-label">Screenshots</div>
              <div class="sa-kpi-value ${data.screenshotHealth.blankRiskFactors.length > 0 ? (data.screenshotHealth.blankRiskFactors.some(r => r.severity === 'critical') ? 'danger' : 'warn') : 'success'}">${data.screenshotHealth.blankRiskFactors.length > 0 ? '⚠️ Check' : '✓ OK'}</div>
              <div class="sa-kpi-detail">${data.screenshots.length} events${data.screenshotHealth.blankRiskFactors.length > 0 ? ', ' + data.screenshotHealth.blankRiskFactors.length + ' risk factor(s)' : ', no blank risks'}</div>
            </div>` : ''}
          </div>

          <div class="sa-checks">
            ${health.checks.map(c => `
              <div class="sa-check ${c.status}">
                ${c.tooltip ? `<div class="sa-tooltip"><strong>${c.label}</strong>${c.tooltip}</div>` : ''}
                <span class="sa-check-icon">${c.icon}</span>
                <div class="sa-check-text">
                  <strong>${c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : '⚠️'} ${c.label}</strong>
                  <span>${c.detail}</span>
                </div>
              </div>
            `).join('')}
          </div>

          ${sa.authenticatedUsers.length > 0 ? `
            <div style="margin-top:16px; padding:12px; background:var(--card); border:1px solid var(--border); border-radius:8px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div style="font-size:13px; font-weight:600; color:var(--link);">👤 Authenticated Users (${sa.authenticatedUsers.length})</div>
                ${sa.authenticatedUsers.length > 1 ? '<span class="tag warn" style="font-size:10px;">Multiple Users</span>' : ''}
              </div>
              ${sa.authenticatedUsers.map(u => {
                const email = (u.email || 'Unknown').replace(/PII->/, '');
                const adminLink = u.userId ? `<a href="https://app.hubstaff.com/admin/members/${u.userId}" target="_blank" rel="noopener" style="color:var(--link); text-decoration:none; margin-left:6px; font-size:10px;" title="Open in Hubstaff Admin">↗ Admin</a>` : '';
                return `<div style="display:flex; align-items:center; gap:10px; padding:6px 8px; margin-bottom:4px; background:var(--panel); border-radius:6px; font-size:12px; border:1px solid var(--border);">
                  <span style="color:var(--accent); font-size:14px;">👤</span>
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <strong style="color:var(--text);">${email}</strong>
                      ${u.userId ? `<span class="tag info" style="font-size:10px;">ID: ${u.userId}</span>` : ''}
                      ${adminLink}
                    </div>
                    <div style="font-size:10px; color:var(--muted); margin-top:2px;">${u.authCount} auth${u.authCount > 1 ? 's' : ''}</div>
                  </div>
                </div>`;
              }).join('')}
              ${sa.authenticatedUsers.length > 1 ? `<div style="margin-top:8px; padding:8px; background:rgba(245,158,11,0.1); border:1px solid var(--warn); border-radius:6px; font-size:11px; color:var(--warn);">
                ⚠️ <strong>Multiple users detected.</strong> Useful for silent computer merging — the FROM member should be changed to the token of the TO member.
              </div>` : ''}
            </div>
          ` : ''}

          ${sa.resumes.length > 0 ? `
            <div class="sa-lifecycle" style="margin-top:16px; border-top:1px dashed var(--border); padding-top:14px;">
              <div class="sa-lifecycle-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                <h4>🔄 Resume Handling & Auto-Track (${sa.resumes.length} resume events, ${sa.autoStartStops.filter(a => a.type === 'START').length} auto-starts)</h4>
                <span class="sa-lc-toggle">▼</span>
              </div>
              <div class="sa-lifecycle-body collapsed">
                ${sa.resumeThreshold ? `<div style="padding:10px 14px; background:var(--panel); border-radius:8px; margin-bottom:10px; font-size:12px;">
                  <strong style="color:var(--accent);">⚙️ Resume Threshold Config:</strong>
                  <span style="margin-left:8px;">Keep: <strong style="color:var(--success);">${sa.resumeThreshold.keep}</strong></span>
                  <span style="margin-left:12px;">Discard: <strong style="color:var(--danger);">${sa.resumeThreshold.discard}</strong></span>
                  <span style="margin-left:12px; color:var(--muted);">— Gaps shorter than "keep" are auto-resumed. Gaps longer than "discard" are thrown away.</span>
                </div>` : ''}
                ${sa.doubleStarts.length > 0 ? `<div style="padding:8px 14px; background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.2); border-radius:8px; margin-bottom:10px; font-size:12px; color:var(--warn);">
                  ⚡ <strong>${sa.doubleStarts.length} Double-Start(s)</strong> — Back-to-back START_TRACKING without a STOP. Indicates crash→restart while tracking.
                </div>` : ''}
                <div class="table-wrap" style="max-height:300px;">
                  <table>
                    <thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead>
                    <tbody>
                      ${sa.resumes.map(r => {
                        let badge, badgeCls, detail;
                        if (r.type === 'DETECTED') {
                          badge = 'RESUME DETECTED'; badgeCls = 'resume';
                          detail = r.duration ? 'Gap: ' + r.duration : 'Duration unknown';
                        } else if (r.type === 'IGNORED') {
                          badge = 'RESUME IGNORED'; badgeCls = 'error';
                          detail = 'Gap exceeded threshold — time discarded';
                        } else if (r.type === 'NEEDS_CONFIRM') {
                          badge = 'NEEDS CONFIRM'; badgeCls = 'resume';
                          detail = 'Waiting for schedule/policy confirmation';
                        } else if (r.type === 'TRACKING') {
                          badge = 'RESUMED'; badgeCls = 'tracking';
                          detail = 'Tracking resumed — gap time kept';
                        } else {
                          badge = r.type; badgeCls = 'auth'; detail = '';
                        }
                        return '<tr' + (r.type === 'IGNORED' ? ' class="sa-ev-highlight"' : '') + '>' +
                          '<td style="font-family:monospace;font-size:10px;white-space:nowrap;color:var(--muted);width:140px;">' + fmtDate(r.ts) + '</td>' +
                          '<td style="width:140px;"><span class="sa-ev-badge ' + badgeCls + '">' + badge + '</span></td>' +
                          '<td>' + detail + '</td></tr>';
                      }).join('')}
                      ${sa.stopErrors.map(e => 
                        '<tr class="sa-ev-highlight"><td style="font-family:monospace;font-size:10px;white-space:nowrap;color:var(--muted);width:140px;">' + fmtDate(e.ts) + '</td>' +
                        '<td style="width:140px;"><span class="sa-ev-badge error">STOP ERROR</span></td>' +
                        '<td>Tracking stopped due to error</td></tr>'
                      ).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ` : ''}

          ${(sa.http429s.length > 0 || sa.sslErrors.length > 0 || sa.systemMemSnapshots.length > 1 || sa.helperDiedEvents.length > 0) ? `
            <div class="sa-lifecycle" style="margin-top:16px; border-top:1px dashed var(--border); padding-top:14px;">
              <div class="sa-lifecycle-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                <h4>🖥️ System Resources & Network Health</h4>
                <span class="sa-lc-toggle">▼</span>
              </div>
              <div class="sa-lifecycle-body collapsed">
                ${sa.systemMemSnapshots.length > 1 ? (() => {
                  const snaps = sa.systemMemSnapshots;
                  const usages = snaps.map(s => (s.usedBytes / s.totalBytes * 100));
                  const avgUsage = (usages.reduce((a,b) => a+b, 0) / usages.length).toFixed(0);
                  const maxUsage = Math.max(...usages).toFixed(0);
                  const minUsage = Math.min(...usages).toFixed(0);
                  const totalGB = (snaps[0].totalBytes / (1024*1024*1024)).toFixed(0);
                  return '<div style="padding:10px 14px; background:var(--panel); border-radius:8px; margin-bottom:10px; font-size:12px;">' +
                    '<strong style="color:var(--accent);">💾 Memory Trend</strong> (' + snaps.length + ' snapshots, ' + totalGB + 'GB total RAM)<br>' +
                    '<span style="margin-top:4px;display:inline-block;">Avg: <strong>' + avgUsage + '%</strong></span>' +
                    '<span style="margin-left:16px;">Min: <strong style="color:var(--success);">' + minUsage + '%</strong></span>' +
                    '<span style="margin-left:16px;">Max: <strong style="color:' + (parseInt(maxUsage) > 90 ? 'var(--danger)' : parseInt(maxUsage) > 75 ? 'var(--warn)' : 'var(--success)') + ';">' + maxUsage + '%</strong></span>' +
                    '</div>';
                })() : ''}
                ${sa.helperDiedEvents.length > 0 ? (() => {
                  // Group by date for trend
                  const byDate = {};
                  sa.helperDiedEvents.forEach(e => {
                    if (!e.ts) return;
                    const d = new Date(e.ts).toISOString().split('T')[0];
                    byDate[d] = (byDate[d] || 0) + 1;
                  });
                  const dates = Object.keys(byDate).sort();
                  if (dates.length > 1) {
                    return '<div style="padding:10px 14px; background:var(--panel); border-radius:8px; margin-bottom:10px; font-size:12px;">' +
                      '<strong style="color:var(--accent);">🔧 Helper Crash Trend</strong> (' + sa.helperDied + ' total)<br>' +
                      '<div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">' +
                      dates.map(d => {
                        const count = byDate[d];
                        const cls = count > 20 ? 'var(--danger)' : count > 10 ? 'var(--warn)' : 'var(--success)';
                        return '<span style="background:rgba(26,16,40,0.5); border:1px solid var(--border); border-radius:4px; padding:2px 8px;">' + d.slice(5) + ': <strong style="color:' + cls + ';">' + count + '</strong></span>';
                      }).join('') +
                      '</div></div>';
                  }
                  return '';
                })() : ''}
                ${(sa.http429s.length > 0 || sa.sslErrors.length > 0) ? `
                  <div class="table-wrap" style="max-height:250px;">
                    <table>
                      <thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead>
                      <tbody>
                        ${sa.http429s.map(e => 
                          '<tr><td style="font-family:monospace;font-size:10px;white-space:nowrap;color:var(--muted);width:140px;">' + fmtDate(e.ts) + '</td>' +
                          '<td style="width:140px;"><span class="sa-ev-badge error">HTTP 429</span></td>' +
                          '<td style="font-size:10px;color:var(--muted);">Rate limited — too many requests</td></tr>'
                        ).join('')}
                        ${sa.sslErrors.map(e =>
                          '<tr><td style="font-family:monospace;font-size:10px;white-space:nowrap;color:var(--muted);width:140px;">' + fmtDate(e.ts) + '</td>' +
                          '<td style="width:140px;"><span class="sa-ev-badge error">SSL ERROR</span></td>' +
                          '<td style="font-size:10px;color:var(--muted);">Secure connection failed</td></tr>'
                        ).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          ${Object.keys(sa.networkBlocks.blockedDomains).length > 0 ? (() => {
            const domains = sa.networkBlocks.blockedDomains;
            const domainList = Object.entries(domains).sort((a, b) => b[1].count - a[1].count);
            const totalFailures = sa.networkBlocks.failedUrls.length;
            const hasSSL = domainList.some(([,d]) => d.errorTypes.has('ssl'));
            const hasTimeout = domainList.some(([,d]) => d.errorTypes.has('timeout'));
            
            const hubstaffDomains = [
              { domain: 'client-api.hubstaff.com', desc: 'Main API — activity sync, screenshots, config' },
              { domain: 'api.hubstaff.com', desc: 'API gateway' },
              { domain: 'hubstaff.com', desc: 'Main website & auth' },
              { domain: 'account.hubstaff.com', desc: 'Account management' },
              { domain: '*.amazonaws.com', desc: 'Screenshot storage (S3)' },
            ];

            return `
            <div style="margin-top:16px; border-top:1px dashed var(--border); padding-top:14px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <div style="font-size:13px; font-weight:700; color:var(--danger);">🚫 Network Block Analysis</div>
                <span class="tag error" style="font-size:10px;">${totalFailures} failed requests across ${domainList.length} domain${domainList.length > 1 ? 's' : ''}</span>
              </div>
              
              <div style="padding:12px; background:rgba(239,68,68,0.05); border:1px solid var(--danger); border-radius:8px; margin-bottom:12px;">
                <div style="font-size:12px; font-weight:600; color:var(--danger); margin-bottom:8px;">⚠️ Blocked Domains Detected</div>
                <div style="font-size:11px; color:var(--text); margin-bottom:8px;">
                  The following Hubstaff domains are failing with ${hasSSL ? 'SSL/TLS errors' : ''}${hasSSL && hasTimeout ? ' and ' : ''}${hasTimeout ? 'connection timeouts' : ''}. 
                  This prevents the app from syncing tracked data, uploading screenshots, and refreshing configuration.
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
                  ${domainList.map(([domain, info]) => {
                    const errorBadges = [...info.errorTypes].map(t => {
                      if (t === 'ssl') return '<span class="tag error" style="font-size:9px;">SSL</span>';
                      if (t === 'timeout') return '<span class="tag warn" style="font-size:9px;">TIMEOUT</span>';
                      if (t === 'upload_fail') return '<span class="tag error" style="font-size:9px;">UPLOAD FAIL</span>';
                      return '<span class="tag info" style="font-size:9px;">' + t.toUpperCase() + '</span>';
                    }).join(' ');
                    const endpoints = [...info.endpoints].slice(0, 5);
                    return '<div style="padding:8px 10px; background:var(--panel); border:1px solid var(--border); border-radius:6px; font-size:11px;">' +
                      '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
                        '<strong style="color:var(--text); font-family:monospace;">' + escapeHtml(domain) + '</strong>' +
                        errorBadges +
                        '<span style="color:var(--muted);">' + info.count + ' failures</span>' +
                      '</div>' +
                      (endpoints.length > 0 ? '<div style="margin-top:4px; color:var(--muted); font-size:10px; font-family:monospace;">' +
                        'Endpoints: ' + endpoints.map(e => escapeHtml(e)).join(', ') +
                      '</div>' : '') +
                    '</div>';
                  }).join('')}
                </div>
              </div>

              <div style="padding:12px; background:rgba(124,58,237,0.05); border:1px solid var(--accent); border-radius:8px;">
                <div style="font-size:12px; font-weight:600; color:var(--accent); margin-bottom:8px;">💡 Next Steps — Share with the customer</div>
                <div style="font-size:11px; color:var(--text); line-height:1.6;">
                  <p style="margin:0 0 8px;">Ask the customer (or their IT admin) to <strong>allow outbound HTTPS connections</strong> and <strong>bypass SSL/TLS inspection</strong> for the following domains:</p>
                  <div style="background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:8px 12px; font-family:monospace; font-size:11px; margin-bottom:8px;">
                    ${hubstaffDomains.map(d => 
                      '<div style="display:flex; justify-content:space-between; padding:2px 0;">' +
                        '<span style="color:var(--link);">' + d.domain + '</span>' +
                        '<span style="color:var(--muted); font-family:system-ui; font-size:10px;">' + d.desc + '</span>' +
                      '</div>'
                    ).join('')}
                  </div>
                  <p style="margin:0 0 6px;">Connections must be allowed over <strong>TCP port 443</strong> without:</p>
                  <ul style="margin:0; padding-left:16px; color:var(--muted);">
                    <li>SSL inspection</li>
                    <li>Proxy rewriting</li>
                    <li>Certificate substitution</li>
                  </ul>
                </div>
              </div>
            </div>`;
          })() : ''}

          ${health.multiDayGaps.length > 0 ? `
            <div style="margin-top:14px; padding-top:14px; border-top:1px dashed var(--border);">
              <div style="font-size:12px; font-weight:700; color:var(--danger); margin-bottom:8px;">🚨 Extended Offline Periods</div>
              <div class="table-wrap" style="max-height:200px;">
                <table>
                  <thead><tr><th>Shutdown</th><th>Next Startup</th><th>Gap Duration</th></tr></thead>
                  <tbody>
                    ${health.multiDayGaps.map(g => `
                      <tr>
                        <td>${fmtDate(g.shutdownTs)}</td>
                        <td>${fmtDate(g.startupTs)}</td>
                        <td style="color:var(--danger); font-weight:600;">${g.gapDays} days (${g.gapHours}h)</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          ${(() => {
            const cycles = buildLifecycleCycles(sa, data);
            return renderLifecycleTimeline(cycles);
          })()}
        </div>
      `;

      container.innerHTML = html;
      container.style.display = 'block';
    }

