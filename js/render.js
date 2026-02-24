    function renderScreenshotHealthPanel(data) {
      const sh = data.screenshotHealth;
      const panel = $('screenshotHealthPanel');
      const badge = $('screenshotHealthBadge');
      
      // If no screenshot events at all, hide panel
      if (data.screenshots.length === 0) {
        panel.style.display = 'none';
        badge.style.display = 'none';
        return;
      }
      
      const hasRisks = sh.blankRiskFactors.length > 0;
      const hasCritical = sh.blankRiskFactors.some(r => r.severity === 'critical');
      
      // Show badge if there are risk factors
      if (hasRisks) {
        badge.style.display = 'inline-block';
        badge.textContent = hasCritical ? '⚠️ Blank Risk' : '⚠️ Check';
        badge.style.background = hasCritical ? '#e74c3c' : '#f39c12';
      } else {
        badge.style.display = 'none';
      }
      
      // Build panel
      let html = '';
      
      // Stats row
      html += `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">`;
      html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;flex:1;min-width:120px;text-align:center;">
        <div style="font-size:20px;font-weight:600;color:var(--accent);">${sh.captures.length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Captures</div>
      </div>`;
      html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;flex:1;min-width:120px;text-align:center;">
        <div style="font-size:20px;font-weight:600;color:var(--accent);">${sh.uploads.length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Uploads</div>
      </div>`;
      html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 14px;flex:1;min-width:120px;text-align:center;">
        <div style="font-size:20px;font-weight:600;color:${sh.failures.length > 0 ? '#e74c3c' : 'var(--success)'};">${sh.failures.length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Failures</div>
      </div>`;
      if (hasRisks) {
        html += `<div style="background:${hasCritical ? 'rgba(231,76,60,0.1)' : 'rgba(243,156,18,0.1)'};border:1px solid ${hasCritical ? 'rgba(231,76,60,0.3)' : 'rgba(243,156,18,0.3)'};border-radius:8px;padding:8px 14px;flex:1;min-width:120px;text-align:center;">
          <div style="font-size:20px;font-weight:600;color:${hasCritical ? '#e74c3c' : '#f39c12'};">${sh.blankRiskFactors.length}</div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;">Blank Risk Factors</div>
        </div>`;
      }
      html += `</div>`;
      
      // Risk factors
      if (hasRisks) {
        html += `<div style="background:rgba(243,156,18,0.08);border:1px solid rgba(243,156,18,0.25);border-radius:8px;padding:12px;margin-bottom:8px;">`;
        html += `<div style="font-weight:600;margin-bottom:8px;color:#f39c12;">⚠️ Screenshots May Be Blank or Black</div>`;
        html += `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">The logs show screenshot uploads occurring, but the following risk factors suggest the actual images may be blank, black, or show only the desktop wallpaper. <strong>Check the Hubstaff dashboard Activity page to verify.</strong></div>`;
        
        sh.blankRiskFactors.forEach(rf => {
          const color = rf.severity === 'critical' ? '#e74c3c' : rf.severity === 'warning' ? '#f39c12' : '#3498db';
          const icon = rf.severity === 'critical' ? '🔴' : rf.severity === 'warning' ? '🟡' : '🔵';
          html += `<div style="padding:8px 10px;margin-bottom:6px;background:var(--surface);border-radius:6px;border-left:3px solid ${color};">
            <div style="font-weight:500;font-size:12px;">${icon} ${escapeHtml(rf.reason)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px;">${rf.detail}</div>
          </div>`;
        });
        
        // Actionable help
        html += `<div style="margin-top:10px;padding:8px 10px;background:var(--surface);border-radius:6px;border-left:3px solid var(--accent);">
          <div style="font-weight:500;font-size:12px;">💡 What to Do</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">
            <strong>1.</strong> Check the Activity page in Hubstaff dashboard — are the screenshots actually blank?<br>
            <strong>2.</strong> <strong>macOS:</strong> Ensure screen recording permission is granted: System Settings → Privacy & Security → Screen & System Audio Recording → toggle Hubstaff ON. May require quit & reopen.<br>
            <strong>3.</strong> <strong>Windows:</strong> Check for web-shield/antivirus software (McAfee, Norton, Webroot) or VirtualBox that may block screen capture.<br>
            <strong>4.</strong> <strong>Sleep:</strong> If the computer goes to sleep while tracking, screenshots captured at that moment will be black.<br>
            <strong>5.</strong> Reference: <a href="https://support.hubstaff.com/blank-black-screenshot-images-activity-page/" target="_blank" style="color:var(--accent);">Hubstaff: Blank/Black Screenshots</a> · <a href="https://support.hubstaff.com/how-to-give-hubstaff-screen-capture-permissions-on-macos/" target="_blank" style="color:var(--accent);">macOS Permissions Guide</a>
          </div>
        </div>`;
        
        html += `</div>`;
      } else if (data.screenshots.length > 0) {
        // No risk factors — show success
        html += `<div style="background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:8px;padding:10px 12px;">
          <span style="color:var(--success);font-weight:500;">✅ Screenshots look healthy</span>
          <span style="font-size:11px;color:var(--muted);margin-left:8px;">${sh.captures.length} captured, ${sh.uploads.length} uploaded, no blank screenshot risk factors detected.</span>
        </div>`;
      }
      
      panel.innerHTML = html;
      panel.style.display = 'block';
    }

    function renderLevelTag(level) {
      const cls = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : level === 'AUDIT' ? 'audit' : level === 'INFO' ? 'info' : level === 'DEBUG' ? 'debug' : 'trace';
      return `<span class="tag ${cls}">${level}</span>`;
    }

    function render(data) {
      const plainMode = $('plainMode').checked;
      
      if (!data) {
        $('kpiTotal').textContent = '0';
        $('kpiErrors').textContent = '0';
        $('kpiWarnings').textContent = '0';
        $('kpiTrackedTime').textContent = '0:00:00';
        $('kpiIdleKept').textContent = '0:00:00';
        $('kpiIdleDisc').textContent = '0:00:00';
        $('kpiTimezone').textContent = '--';
        $('kpiTimeSpan').textContent = '--';
        $('errorsList').innerHTML = '<div class="event-item" style="color:var(--muted)">No errors found</div>';
        $('warningsList').innerHTML = '<div class="event-item" style="color:var(--muted)">No warnings found</div>';
        $('screenshotsBody').innerHTML = '';
        $('screenshotHealthPanel').style.display = 'none';
        $('screenshotHealthPanel').innerHTML = '';
        $('screenshotHealthBadge').style.display = 'none';
        $('networkBody').innerHTML = '';
        $('locationsBody').innerHTML = '';
        $('appsBody').innerHTML = '';
        $('trackingBody').innerHTML = '';
        $('searchBody').innerHTML = '';
        $('summaryCard').style.display = 'none';
        $('sessionsCard').style.display = 'none';
        $('sessionsBody').innerHTML = '';
        $('idleBody').innerHTML = '';
        // Reset badge counts
        ['errors', 'warnings', 'screenshots', 'network', 'locations', 'apps', 'injected', 'tracking', 'search', 'sessions'].forEach(s => {
          const badge = $(s + 'Count');
          if (badge) badge.textContent = '0';
        });
        $('injectedBody').innerHTML = '';
        return;
      }

      // Calculate total tracked time
      const totalTrackedSecs = data.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      $('kpiTotal').textContent = data.total.toLocaleString();
      $('kpiErrors').textContent = data.errors.length;
      $('kpiWarnings').textContent = data.warnings.length;
      $('kpiTrackedTime').textContent = fmtDuration(totalTrackedSecs);
      $('kpiIdleKept').textContent = fmtDuration(data.idleKeptSecs);
      $('kpiIdleDisc').textContent = fmtDuration(data.idleDiscardedSecs);
      $('kpiTimezone').textContent = data.timezone || 'Unknown';
      $('kpiTimezone').style.fontSize = data.timezone ? '18px' : '14px';

      // Update badge counts
      $('errorsCount').textContent = data.errors.length;
      $('warningsCount').textContent = data.warnings.length;
      $('screenshotsCount').textContent = data.screenshots.length;
      $('networkCount').textContent = data.network.length;
      $('locationsCount').textContent = data.locations.length;
      $('appsCount').textContent = data.apps.length;
      $('injectedCount').textContent = data.injected.length;
      $('trackingCount').textContent = data.tracking.length;
      $('sessionsCount').textContent = data.sessions.length;

      // Update badge colors based on counts
      $('errorsCount').className = 'badge ' + (data.errors.length > 0 ? 'danger' : '');
      $('warningsCount').className = 'badge ' + (data.warnings.length > 0 ? 'warn' : '');
      $('networkCount').className = 'badge ' + (data.network.length > 0 ? 'warn' : '');
      $('injectedCount').className = 'badge ' + (data.injected.length > 0 ? 'warn' : '');

      if (data.startTime && data.endTime) {
        const diffMs = data.endTime - data.startTime;
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        $('kpiTimeSpan').textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
      } else {
        $('kpiTimeSpan').textContent = '--';
      }

      // Generate and render device dashboard
      const deviceStatus = generateDeviceDashboard(data);
      renderDeviceDashboard(deviceStatus);

      // Generate and render silent app dashboard
      renderSilentAppDashboard(data.silentApp, data);
      
      // Generate and render root cause conclusion (only for mobile/location logs)
      if (plainMode && !data.silentApp.detected && (deviceStatus.device.manufacturer || deviceStatus.location.servicesEnabled !== null || deviceStatus.location.isPrimary !== null)) {
        const conclusion = generateRootCauseConclusion(deviceStatus, data);
        $('rootCauseCard').innerHTML = conclusion.html;
        $('rootCauseCard').style.display = 'block';
      } else {
        $('rootCauseCard').style.display = 'none';
      }

      // Generate and render summary if plain mode
      if (plainMode) {
        const findings = generateSummary(data);
        $('summaryCard').style.display = 'block';
        $('summaryContent').innerHTML = findings.map((f, i) => `
          <div class="summary-item ${f.severity}">
            <h4>${f.icon} ${f.title} ${f.techDetail ? `<span class="show-tech" onclick="toggleTech(${i})">Show technical</span>` : ''}</h4>
            <p>${f.description}</p>
            ${f.action ? `<div class="action">💡 <strong>What to do:</strong> ${f.action}</div>` : ''}
            ${f.techDetail ? `<div class="tech-detail" id="tech-${i}">${escapeHtml(f.techDetail)}</div>` : ''}
          </div>
        `).join('');
      } else {
        $('summaryCard').style.display = 'none';
      }

      // === RENDER AUTHENTICATED USERS ===
      if (data.authenticatedUsers.length > 0) {
        $('authenticatedUsersPanel').style.display = 'block';
        $('authUserCount').textContent = data.authenticatedUsers.length;
        
        const adminBaseUrl = 'https://app.hubstaff.com/organizations/';
        $('authenticatedUsersList').innerHTML = data.authenticatedUsers.map(u => {
          const email = u.email ? escapeHtml(u.email).replace(/PII->/, '') : 'Unknown';
          const displayEmail = email.replace(/PII->/, '');
          const id = u.userId || '—';
          const auths = u.authCount;
          const first = u.firstSeen ? fmtTime(u.firstSeen) : '—';
          const last = u.lastSeen ? fmtTime(u.lastSeen) : '—';
          const adminLink = u.userId ? `<a href="https://app.hubstaff.com/admin/users/${u.userId}" target="_blank" rel="noopener" style="color:var(--link); text-decoration:none; margin-left:6px; font-size:10px;" title="Open in Hubstaff Admin">↗ Admin</a>` : '';
          
          return `<div style="display:flex; align-items:center; gap:12px; padding:6px 8px; margin-bottom:4px; background:var(--panel); border-radius:6px; font-size:12px; border:1px solid var(--border);">
            <span style="color:var(--accent); font-size:14px;">👤</span>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong style="color:var(--text);">${displayEmail}</strong>
                ${u.userId ? `<span class="tag info" style="font-size:10px;">ID: ${id}</span>` : ''}
                ${adminLink}
              </div>
              <div style="font-size:10px; color:var(--muted); margin-top:2px;">
                ${auths} auth${auths > 1 ? 's' : ''} · First: ${first} · Last: ${last}
              </div>
            </div>
          </div>`;
        }).join('');

        // Multi-user warning
        if (data.authenticatedUsers.length > 1) {
          $('multiUserWarning').style.display = 'block';
        }
      } else {
        $('authenticatedUsersPanel').style.display = 'none';
      }

      // === RENDER SESSIONS TABLE ===
      if (data.sessions.length > 0) {
        $('sessionsCard').style.display = 'block';
        $('stopReasonLegend').style.display = plainMode ? 'block' : 'none';
        
        // Calculate log duration vs tracked time
        const logDurationSecs = data.startTime && data.endTime ? (data.endTime - data.startTime) / 1000 : 0;
        const totalTrackedSecs = data.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const hasShortUserStops = data.sessions.some(s => s.stopReason === 'USER' && s.duration < 60);
        
        // Show explainer if there's a big mismatch or short USER stops
        if (plainMode && (logDurationSecs > 600 && totalTrackedSecs < logDurationSecs * 0.1) || hasShortUserStops) {
          let explainerHtml = '<h4>📖 Understanding These Results</h4>';
          
          if (logDurationSecs > 600 && totalTrackedSecs < logDurationSecs * 0.1) {
            explainerHtml += `
              <p><span class="key-point">Why does the log cover ${fmtDuration(logDurationSecs)} but only ${fmtDuration(totalTrackedSecs)} was tracked?</span></p>
              <p>The Hubstaff app continuously logs background activity (app focus, URLs, system status) even when the timer is <strong>not</strong> running. This is normal diagnostic behavior.</p>
              <ul>
                <li>Only time between START_TRACKING and STOP_TRACKING counts as paid time</li>
                <li>Background logs do NOT represent lost or missing time</li>
                <li>The ${fmtDuration(logDurationSecs)} log window includes all app activity, not just tracked time</li>
              </ul>
            `;
          }
          
          if (hasShortUserStops) {
            const shortSessions = data.sessions.filter(s => s.stopReason === 'USER' && s.duration < 60);
            explainerHtml += `
              <p><span class="key-point">What does "User stopped" mean?</span></p>
              <p>The stop was logged as a normal, user-initiated stop. This is <strong>not</strong> a crash or error.</p>
              <ul>
                <li>If the app had crashed → we'd see "Crashed" or missing stop events</li>
                <li>If an error caused it → we'd see error markers in the stop reason</li>
                <li>Network errors, high CPU, or timezone issues do NOT cause "User stopped" events</li>
              </ul>
              <p>If the user disputes stopping manually, possible explanations include: accidental click, trackpad sensitivity, another user, or remote access software.</p>
            `;
          }
          
          $('sessionExplainer').innerHTML = explainerHtml;
          $('sessionExplainer').style.display = 'block';
        } else {
          $('sessionExplainer').style.display = 'none';
        }
        
        $('sessionsBody').innerHTML = data.sessions.map((s, i) => {
          const stopReasonCls = s.stopReason === 'USER' ? 'success' : 
                                s.stopReason === 'IDLE' ? 'warn' : 
                                s.stopReason === 'CRASHED' || s.stopReason === 'LOG_END' ? 'error' :
                                s.stopReason === 'CONFIG' || s.stopReason === 'LEFT_JOBSITE' ? 'error' : 'info';
          const startReasonBadge = s.startReason === 'RESUMED' ? '<span class="tag audit" style="margin-left:4px;">RESUMED</span>' : '';
          
          let stopReasonText = s.stopReason;
          let stopReasonTooltip = '';
          if (plainMode) {
            if (s.stopReason === 'USER') {
              stopReasonText = 'User stopped';
              stopReasonTooltip = 'Logged as normal user stop. Not a crash or error.';
            }
            else if (s.stopReason === 'IDLE') stopReasonText = 'Went idle';
            else if (s.stopReason === 'CRASHED') stopReasonText = '⚠️ Crashed';
            else if (s.stopReason === 'LOG_END') stopReasonText = '⚠️ Still running?';
            else if (s.stopReason === 'CONFIG') stopReasonText = 'Config/Limit';
            else if (s.stopReason === 'LEFT_JOBSITE') stopReasonText = '📍 Left Job Site';
            else if (s.stopReason === 'SHUTDOWN') stopReasonText = 'App closed';
          }
          
          const durationWarning = s.duration < 30 ? ' ⚡' : '';
          
          return `<tr>
            <td>${i + 1}${startReasonBadge}</td>
            <td>${fmtTime(s.start)}</td>
            <td>${s.stop ? fmtTime(s.stop) : '--'}</td>
            <td><span class="tag success">${fmtDuration(s.duration)}${durationWarning}</span></td>
            <td><span class="tag ${stopReasonCls}" ${stopReasonTooltip ? `title="${stopReasonTooltip}"` : ''}>${stopReasonText}</span></td>
          </tr>`;
        }).join('');
      } else {
        $('sessionsCard').style.display = 'block';
        $('sessionsBody').innerHTML = '<tr><td colspan="5" style="color:var(--muted)">No tracking sessions found in log</td></tr>';
        $('sessionExplainer').style.display = 'none';
        $('stopReasonLegend').style.display = 'none';
      }

      // === RENDER IDLE DECISIONS TABLE ===
      if (data.idleDecisions.length > 0) {
        $('idleBody').innerHTML = data.idleDecisions.map(d => {
          // Determine display class and text based on decision
          let decisionCls, actionText, actionIcon;
          if (d.decision === 'KEPT') {
            decisionCls = 'success';
            actionIcon = '✅';
            actionText = 'KEPT - User clicked YES';
          } else if (d.decision === 'DISCARDED_STOPPED') {
            decisionCls = 'error';
            actionIcon = '🛑';
            actionText = 'DISCARDED + STOPPED tracking';
          } else {
            decisionCls = 'warn';
            actionIcon = '❌';
            actionText = 'DISCARDED - User clicked NO';
          }
          
          // Add warning if exceeds 1 hour (idle time can't be kept)
          let durationNote = '';
          if (d.exceeds1Hour) {
            durationNote = ' <span style="color:var(--danger);font-size:10px;" title="Idle time exceeding 1 hour cannot be kept">⚠️ >1hr</span>';
          }
          
          // Response time (how long user took to answer the dialog)
          const responseTime = d.responseTimeSecs ? `${d.responseTimeSecs}s` : '—';
          
          return `<tr>
            <td>${fmtDate(d.ts)}</td>
            <td>${fmtDuration(d.seconds)}${durationNote}</td>
            <td style="color:var(--muted)">${responseTime}</td>
            <td><span class="tag ${decisionCls}">${plainMode ? (actionIcon + ' ' + actionText) : d.decision}</span></td>
            <td style="font-family:monospace;font-size:10px;color:var(--muted)">${d.rawValues || '—'}</td>
          </tr>`;
        }).join('');
      } else {
        $('idleBody').innerHTML = '<tr><td colspan="5" style="color:var(--muted)">No idle decisions recorded</td></tr>';
      }

      // Errors
      if (data.errors.length) {
        $('errorsList').innerHTML = data.errors.slice(0, 100).map(e => {
          const translation = plainMode ? translateToPlainEnglish(e.msg, e.level, e.src) : null;
          return `
            <div class="event-item">
              <div class="event-time">${fmtTime(e.ts)} ${renderLevelTag(e.level)}</div>
              ${translation ? `<div class="plain-explanation">${translation.text}</div>` : ''}
              <div class="event-detail" style="${plainMode ? 'font-size:10px;color:#666;' : ''}">${escapeHtml(e.msg.slice(0, 200))}</div>
              <div class="event-context">${escapeHtml(e.src)}</div>
            </div>
          `;
        }).join('');
      } else {
        $('errorsList').innerHTML = '<div class="event-item" style="color:var(--success)">✓ No errors found</div>';
      }

      // Warnings
      if (data.warnings.length) {
        $('warningsList').innerHTML = data.warnings.slice(0, 100).map(e => {
          const translation = plainMode ? translateToPlainEnglish(e.msg, e.level, e.src) : null;
          return `
            <div class="event-item">
              <div class="event-time">${fmtTime(e.ts)} ${renderLevelTag(e.level)}</div>
              ${translation ? `<div class="plain-explanation">${translation.text}</div>` : ''}
              <div class="event-detail" style="${plainMode ? 'font-size:10px;color:#666;' : ''}">${escapeHtml(e.msg.slice(0, 200))}</div>
              <div class="event-context">${escapeHtml(e.src)}</div>
            </div>
          `;
        }).join('');
      } else {
        $('warningsList').innerHTML = '<div class="event-item" style="color:var(--success)">✓ No warnings found</div>';
      }

      // Screenshots
      createVirtualTable('screenshots', 'screenshotsBody', data.screenshots, (e) => `
        <tr>
          <td>${fmtTime(e.ts)}</td>
          <td>${renderLevelTag(e.level)}</td>
          <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.msg)}</td>
        </tr>
      `, 'No screenshot events found');

      // Screenshot Health Panel
      renderScreenshotHealthPanel(data);

      // Network
      $('networkBody').innerHTML = ''; // cleared before virtual render
      createVirtualTable('network', 'networkBody', data.network, (e) => {
        let statusCls = 'info';
        if (e.msg.match(/Response:\s*[45]\d{2}/)) statusCls = 'error';
        else if (e.msg.includes('Error')) statusCls = 'error';
        return `
          <tr>
            <td>${fmtTime(e.ts)}</td>
            <td><span class="tag ${statusCls}">${e.level}</span></td>
            <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.msg)}</td>
          </tr>
        `;
      }, 'No network issues found');

      // Network Block Analysis (if blocked domains detected)
      const nb = data.networkBlocks;
      const nbDomains = Object.keys(nb.blockedDomains);
      const nbPanel = document.getElementById('networkBlockAnalysis');
      if (nbDomains.length > 0 && nbPanel) {
        const domainList = Object.entries(nb.blockedDomains).sort((a, b) => b[1].count - a[1].count);
        const hasSSL = domainList.some(([,d]) => d.errorTypes.has('ssl'));
        const hasTimeout = domainList.some(([,d]) => d.errorTypes.has('timeout'));
        
        const hubstaffDomains = [
          { domain: 'client-api.hubstaff.com', desc: 'Main API — activity sync, screenshots, config' },
          { domain: 'api.hubstaff.com', desc: 'API gateway' },
          { domain: 'hubstaff.com', desc: 'Main website & auth' },
          { domain: 'account.hubstaff.com', desc: 'Account management' },
          { domain: '*.amazonaws.com', desc: 'Screenshot storage (S3)' },
        ];

        nbPanel.innerHTML = `
          <div style="font-size:13px; font-weight:700; color:var(--danger); margin-bottom:10px;">🚫 Network Block Analysis</div>
          <div style="padding:12px; background:rgba(239,68,68,0.05); border:1px solid var(--danger); border-radius:8px; margin-bottom:12px;">
            <div style="font-size:12px; font-weight:600; color:var(--danger); margin-bottom:8px;">⚠️ ${nb.failedUrls.length} failed requests across ${domainList.length} domain${domainList.length > 1 ? 's' : ''}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${domainList.map(([domain, info]) => {
                const errorBadges = [...info.errorTypes].map(t => {
                  if (t === 'ssl') return '<span class="tag error" style="font-size:9px;">SSL</span>';
                  if (t === 'timeout') return '<span class="tag warn" style="font-size:9px;">TIMEOUT</span>';
                  if (t === 'upload_fail') return '<span class="tag error" style="font-size:9px;">UPLOAD FAIL</span>';
                  return '<span class="tag info" style="font-size:9px;">' + t.toUpperCase() + '</span>';
                }).join(' ');
                return '<div style="padding:6px 8px; background:var(--panel); border:1px solid var(--border); border-radius:6px; font-size:11px;">' +
                  '<strong style="font-family:monospace;">' + escapeHtml(domain) + '</strong> ' + errorBadges +
                  ' <span style="color:var(--muted);">' + info.count + ' failures</span></div>';
              }).join('')}
            </div>
          </div>
          <div style="padding:12px; background:rgba(124,58,237,0.05); border:1px solid var(--accent); border-radius:8px;">
            <div style="font-size:12px; font-weight:600; color:var(--accent); margin-bottom:6px;">💡 Next Steps</div>
            <div style="font-size:11px; line-height:1.6;">
              <p style="margin:0 0 6px;">Ask the customer to allow outbound HTTPS and bypass SSL/TLS inspection for:</p>
              <div style="background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-family:monospace; font-size:11px; margin-bottom:6px;">
                ${hubstaffDomains.map(d => '<div><span style="color:var(--link);">' + d.domain + '</span></div>').join('')}
              </div>
              <p style="margin:0; color:var(--muted);">Over TCP port 443, without SSL inspection, proxy rewriting, or certificate substitution.</p>
            </div>
          </div>
        `;
        nbPanel.style.display = 'block';
      } else if (nbPanel) {
        nbPanel.style.display = 'none';
      }

      // Locations
      // First render job sites summary if we have site data
      let locationsPreamble = '';
      
      if (data.jobSites.length > 0) {
        // Deduplicate sites by ID
        const uniqueSites = [...new Map(data.jobSites.map(s => [s.id, s])).values()];
        const radiusCounts = {};
        uniqueSites.forEach(s => {
          radiusCounts[s.radius] = (radiusCounts[s.radius] || 0) + 1;
        });
        const smallRadiusSites = uniqueSites.filter(s => s.radius <= 50);
        
        // Get user's most recent location
        const lastUserLoc = data.userLocations.length > 0 ? data.userLocations[data.userLocations.length - 1] : null;
        
        // Check if user was ever inside a site
        const enteredAnySite = data.currentlyEnteredSites.some(e => e.sites && e.sites.length > 0);
        
        locationsPreamble = `
          <div class="job-sites-summary">
            <h4>📍 Job Sites Configuration</h4>
            <div class="stats-row">
              <div class="stat"><span class="stat-value">${uniqueSites.length}</span><span class="stat-label">Total Sites</span></div>
              <div class="stat"><span class="stat-value">${Object.keys(radiusCounts).map(r => `${radiusCounts[r]}×${r}m`).join(', ')}</span><span class="stat-label">Radius Distribution</span></div>
              ${smallRadiusSites.length > 0 ? `<div class="stat"><span class="stat-value radius-small">⚠️ ${smallRadiusSites.length} sites with 50m radius</span></div>` : ''}
            </div>
            ${!enteredAnySite && data.currentlyEnteredSites.length > 0 ? `
              <div style="color:var(--warn); font-size:11px; margin-top:8px;">
                ⚠️ User was never detected inside any job site during this log period. All "currently entered sites" checks returned empty.
              </div>
            ` : ''}
            <details style="margin-top:10px;">
              <summary style="cursor:pointer; color:var(--accent); font-size:12px;">Show all ${uniqueSites.length} job sites</summary>
              <div class="job-sites-table">
                <table>
                  <thead><tr><th>Site Name</th><th>Radius</th><th>Coordinates</th></tr></thead>
                  <tbody>
                    ${uniqueSites.slice(0, 100).map(s => `
                      <tr>
                        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</td>
                        <td><span class="${s.radius <= 50 ? 'radius-small' : 'radius-ok'}">${s.radius}m</span></td>
                        <td style="font-family:monospace;font-size:10px;">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</td>
                      </tr>
                    `).join('')}
                    ${uniqueSites.length > 100 ? `<tr><td colspan="3" style="color:var(--muted)">... and ${uniqueSites.length - 100} more sites</td></tr>` : ''}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
          ${lastUserLoc ? `
            <div class="user-location-box">
              <h4>📱 User's Last Known Location</h4>
              <div class="coords">${lastUserLoc.lat.toFixed(6)}, ${lastUserLoc.lng.toFixed(6)}</div>
              <div style="color:var(--muted); margin-top:4px;">Accuracy: ${lastUserLoc.accuracy}m at ${fmtTime(lastUserLoc.ts)}</div>
              ${lastUserLoc.accuracy > 50 ? `<div style="color:var(--warn); margin-top:4px;">⚠️ GPS accuracy is poor (${lastUserLoc.accuracy}m). This may affect job site detection.</div>` : ''}
            </div>
          ` : ''}
        `;
      }
      
      // Prepend job sites info to locations content
      const locationsContentEl = $('locationsContent');
      let existingPreamble = locationsContentEl.querySelector('.job-sites-summary');
      if (existingPreamble) existingPreamble.remove();
      let existingUserLoc = locationsContentEl.querySelector('.user-location-box');
      if (existingUserLoc) existingUserLoc.remove();
      
      if (locationsPreamble) {
        const preambleDiv = document.createElement('div');
        preambleDiv.innerHTML = locationsPreamble;
        locationsContentEl.insertBefore(preambleDiv, locationsContentEl.firstChild);
      }

      // Render visit history
      renderVisitHistory(data);
      
      createVirtualTable('locations', 'locationsBody', data.locations, (e) => `
        <tr>
          <td>${fmtTime(e.ts)}</td>
          <td>${renderLevelTag(e.level)}</td>
          <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.msg)}</td>
        </tr>
      `, 'No location events found');

      // Apps
const appsRowRenderer = (e) => {
  let type = e.extractedType || 'App';
  let content = '';
  
  if (e.extractedUrl) {
    content = e.extractedUrl;
  } else if (e.extractedTitle) {
    content = e.extractedTitle;
  } else if (e.extractedApp) {
    content = e.extractedApp;
  } else {
    // Fallback: try to extract from raw line
    const urlMatch = e.raw.match(/URL:\s*(\S+)/);
    const titleMatch = e.raw.match(/TITLE:\s*(.+)/);
    const appMatch = e.raw.match(/APP:\s*(.+)/);
    
    if (urlMatch && urlMatch[1]) {
      type = 'URL';
      content = urlMatch[1];
    } else if (titleMatch && titleMatch[1].trim()) {
      type = 'Title';
      content = titleMatch[1].trim();
    } else if (appMatch && appMatch[1].trim()) {
      type = 'App';
      content = appMatch[1].trim();
    } else {
      content = e.msg;
    }
  }
  
  // Skip if no meaningful content
  if (!content || content === 'TITLE:' || content.trim() === '') {
    return '';
  }
  
  // Check for Brave Browser - URL tracking not supported
  const isBrave = content.toLowerCase().includes('brave');
  const braveWarning = isBrave ? ' <span class="tag warn" title="Hubstaff does not support URL tracking in Brave Browser. Consider using Chrome, Edge, Firefox, or Island Browser instead." style="cursor:help;">⚠️ No URL tracking</span>' : '';
  
  const tagClass = type === 'URL' ? 'info' : type === 'Title' ? 'audit' : 'success';
  
  return `
    <tr>
      <td>${fmtTime(e.ts)}</td>
      <td><span class="tag ${tagClass}">${type}</span>${braveWarning}</td>
      <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(content)}">${escapeHtml(content)}</td>
    </tr>
  `;
};
createVirtualTable('apps', 'appsBody', data.apps, appsRowRenderer, 'No app/URL events found');

// Update apps count to reflect actual valid entries (excluding empty ones)
const actualAppsCount = data.apps.filter(e => {
  if (e.extractedUrl || e.extractedTitle || e.extractedApp) return true;
  const urlMatch = e.raw.match(/URL:\s*(\S+)/);
  return urlMatch && urlMatch[1];
}).length;
$('appsCount').textContent = actualAppsCount;

      // Injected Input
      createVirtualTable('injected', 'injectedBody', data.injected, (e) => {
        let type = 'Injected';
        let tagClass = 'warn';
        let displayMsg = e.msg;
        
        // Use parsed data if available
        if (e.inputType === 'simulated') {
          type = 'Simulated';
          tagClass = 'info';
          displayMsg = e.inputDetail || 'Hardware not recognized - input simulated for both mouse and keyboard';
        } else if (e.inputType === 'injected') {
          if (e.onlyInjected) {
            type = 'Only Injected';
            tagClass = 'danger';
          } else {
            type = 'Injected';
            tagClass = 'warn';
          }
          displayMsg = e.inputDetail || e.msg;
        } else {
          // Fallback for legacy parsing
          if (e.msg.toLowerCase().includes('simulating missed input')) {
            type = 'Simulated';
            tagClass = 'info';
          } else if (e.msg.toLowerCase().includes('only injected')) {
            type = 'Only Injected';
            tagClass = 'danger';
          }
        }
        
        return `
          <tr>
            <td>${fmtTime(e.ts)}</td>
            <td><span class="tag ${tagClass}">${type}</span></td>
            <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(e.msg)}">${escapeHtml(displayMsg)}</td>
          </tr>
        `;
      }, '✓ No injected or simulated input detected');

      // Tracking
      createVirtualTable('tracking', 'trackingBody', data.tracking, (e) => {
        let eventType = 'Event';
        if (e.msg.includes('Resume')) eventType = 'Resume';
        else if (e.msg.includes('Idle')) eventType = 'Idle';
        else if (e.msg.includes('Discard')) eventType = 'Discard';
        else if (e.msg.includes('Startup')) eventType = 'Startup';
        else if (e.msg.includes('START_TRACKING')) eventType = 'Start';
        else if (e.msg.includes('STOP_TRACKING')) eventType = 'Stop';
        const typeCls = eventType === 'Discard' ? 'warn' : eventType === 'Resume' ? 'success' : 'info';
        return `
          <tr>
            <td>${fmtTime(e.ts)}</td>
            <td><span class="tag ${typeCls}">${eventType}</span></td>
            <td style="font-size:11px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.msg)}</td>
          </tr>
        `;
      }, 'No tracking events found');

      // Render timeline
      renderTimeline(data);
    }

