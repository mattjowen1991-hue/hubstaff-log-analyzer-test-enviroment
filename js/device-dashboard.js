    // === DEVICE STATUS DASHBOARD GENERATION ===
    function generateDeviceDashboard(data) {
      // Extract user info
      const userPropsLine = allLines.find(line => line.includes('user_id=') && line.includes('user_name='));
      let userId = null, userName = null, userEmail = null, orgName = null, orgId = null;
      
      if (userPropsLine) {
        const userIdMatch = userPropsLine.match(/user_id=(\d+)/);
        const userNameMatch = userPropsLine.match(/user_name=([^,}]+)/);
        const userEmailMatch = userPropsLine.match(/user_email=([^,}]+)/);
        const orgNameMatch = userPropsLine.match(/organization_name=([^,}]+)/);
        const orgIdMatch = userPropsLine.match(/organization_id=(\d+)/);
        
        if (userIdMatch) userId = userIdMatch[1];
        if (userNameMatch) userName = userNameMatch[1];
        if (userEmailMatch) userEmail = userEmailMatch[1];
        if (orgNameMatch) orgName = orgNameMatch[1];
        if (orgIdMatch) orgId = orgIdMatch[1];
      }
      
      // Extract device info
      const deviceLine = allLines.find(line => line.includes('device manufacturer'));
      let manufacturer = null, model = null, osVersion = null;
      
      if (deviceLine) {
        const mfgMatch = deviceLine.match(/manufacturer\s*:\s*(\w+)/i);
        const modelMatch = deviceLine.match(/model:\s*([\w-]+)/i);
        const osMatch = deviceLine.match(/OS:\s*(\d+)/i);
        if (mfgMatch) manufacturer = mfgMatch[1];
        if (modelMatch) model = modelMatch[1];
        if (osMatch) osVersion = osMatch[1];
      }
      
      // Extract location state
      const locationStateLine = allLines.find(line => line.includes('locationState is'));
      let servicesEnabled = null, permissionsEnabled = null, accuracyEnabled = null, locationEnabled = null;
      
      if (locationStateLine) {
        servicesEnabled = locationStateLine.includes('SERVICES_ENABLED');
        permissionsEnabled = locationStateLine.includes('PERMISSIONS_ENABLED');
        accuracyEnabled = locationStateLine.includes('ACCURACY_ENABLED');
        locationEnabled = locationStateLine.includes('locationEnabled = true');
      }
      
      // Extract primary device status
      const primaryLine = allLines.find(line => line.includes('primary:'));
      let isPrimary = null;
      if (primaryLine) {
        isPrimary = primaryLine.includes('primary: true');
      }
      
      // Extract permission states
      const permStateLine = allLines.find(line => line.includes('permission state is State'));
      let notificationPerm = null, foregroundLocPerm = null, backgroundLocPerm = null, motionPerm = null;
      
      if (permStateLine) {
        notificationPerm = permStateLine.includes('NOTIFICATION, enabled=true');
        foregroundLocPerm = permStateLine.includes('FOREGROUND_LOCATION, enabled=true');
        backgroundLocPerm = permStateLine.includes('BACKGROUND_LOCATION, enabled=true');
        motionPerm = permStateLine.includes('USER_MOTION, enabled=true');
      }
      
      // Extract device state
      const deviceStateLine = allLines.find(line => line.includes('isIgnoringBatteryOptimization'));
      let batteryOptDisabled = null, powerSaveMode = null, deviceIdle = null, wifiEnabled = null, isInteractive = null;
      
      if (deviceStateLine) {
        batteryOptDisabled = deviceStateLine.includes('isIgnoringBatteryOptimization: =true');
        powerSaveMode = deviceStateLine.includes('isPowerSaveMode: =true');
        deviceIdle = deviceStateLine.includes('isDeviceIdle: =true');
        wifiEnabled = deviceStateLine.includes('isWifiEnabled: =true');
        isInteractive = deviceStateLine.includes('isInteractive: =true');
      }
      
      // Count issues
      const dnsErrors = allLines.filter(line => line.includes('Could not resolve host') || line.includes('UnknownHostException')).length;
      const uncleanStartups = allLines.filter(line => line.includes('STARTUP_UNCLEAN')).length;
      const jobSiteBlocks = allLines.filter(line => line.includes('TRACKING_NOT_STARTED') || line.includes('requires being at a job site')).length;
      
      // Build status object
      return {
        user: { id: userId, name: userName, email: userEmail },
        org: { id: orgId, name: orgName },
        device: { manufacturer, model, osVersion },
        location: {
          isPrimary,
          servicesEnabled,
          permissionsEnabled,
          accuracyEnabled,
          locationEnabled
        },
        permissions: {
          notification: notificationPerm,
          foregroundLocation: foregroundLocPerm,
          backgroundLocation: backgroundLocPerm,
          motion: motionPerm
        },
        deviceState: {
          batteryOptDisabled,
          powerSaveMode,
          deviceIdle,
          wifiEnabled,
          isInteractive
        },
        issues: {
          dnsErrors,
          uncleanStartups,
          jobSiteBlocks
        }
      };
    }

    function renderDeviceDashboard(status) {
      if (!status.device.manufacturer && !status.location.servicesEnabled && status.location.isPrimary === null) {
        $('deviceDashboard').style.display = 'none';
        return;
      }
      
      const statusIcon = (value, trueIsGood = true) => {
        if (value === null) return '<span class="status-icon">❓</span>';
        const isGood = trueIsGood ? value : !value;
        return isGood ? '<span class="status-icon success">✅</span>' : '<span class="status-icon error">❌</span>';
      };
      
      const warnIcon = (value, trueIsGood = true) => {
        if (value === null) return '<span class="status-icon">❓</span>';
        const isGood = trueIsGood ? value : !value;
        return isGood ? '<span class="status-icon success">✅</span>' : '<span class="status-icon warning">⚠️</span>';
      };
      
      let html = `
        <div class="device-dashboard">
          <div class="dashboard-header">
            <div class="dashboard-user-info">
              <h3>📱 Device & Location Status</h3>
              ${status.user.name ? `<p><strong>${status.user.name}</strong> (ID: ${status.user.id || 'Unknown'})</p>` : ''}
              ${status.org.name ? `<p>🏢 ${status.org.name}</p>` : ''}
            </div>
            <div class="dashboard-device-info">
              ${status.device.manufacturer ? `<div class="device-model">${status.device.manufacturer} ${status.device.model || ''}</div>` : ''}
              ${status.device.osVersion ? `<div>Android API ${status.device.osVersion}</div>` : ''}
            </div>
          </div>
          
          <div class="dashboard-grid">
            <div class="dashboard-card">
              <h4>📍 Location Status</h4>
              <div class="status-row">${statusIcon(status.location.isPrimary)}<span class="status-label">Primary Device</span></div>
              <div class="status-row">${statusIcon(status.location.locationEnabled)}<span class="status-label">Location Enabled</span></div>
              <div class="status-row">${statusIcon(status.location.servicesEnabled)}<span class="status-label">Services Enabled</span></div>
              <div class="status-row">${statusIcon(status.location.permissionsEnabled)}<span class="status-label">Permissions OK</span></div>
              <div class="status-row">${statusIcon(status.location.accuracyEnabled)}<span class="status-label">Accuracy Enabled</span></div>
            </div>
            
            <div class="dashboard-card">
              <h4>🔐 Permissions</h4>
              <div class="status-row">${statusIcon(status.permissions.foregroundLocation)}<span class="status-label">Foreground Location</span></div>
              <div class="status-row">${statusIcon(status.permissions.backgroundLocation)}<span class="status-label">Background Location</span></div>
              <div class="status-row">${statusIcon(status.permissions.notification)}<span class="status-label">Notifications</span></div>
              <div class="status-row">${statusIcon(status.permissions.motion)}<span class="status-label">Motion/Activity</span></div>
            </div>
            
            <div class="dashboard-card">
              <h4>🔋 Device State</h4>
              <div class="status-row">${warnIcon(status.deviceState.batteryOptDisabled)}<span class="status-label">Battery Opt Disabled</span></div>
              <div class="status-row">${statusIcon(status.deviceState.powerSaveMode, false)}<span class="status-label">Power Save Mode</span><span class="status-value">${status.deviceState.powerSaveMode ? 'ON' : 'OFF'}</span></div>
              <div class="status-row">${statusIcon(status.deviceState.deviceIdle, false)}<span class="status-label">Device Idle (Doze)</span><span class="status-value">${status.deviceState.deviceIdle ? 'YES' : 'NO'}</span></div>
              <div class="status-row">${statusIcon(status.deviceState.wifiEnabled)}<span class="status-label">WiFi</span><span class="status-value">${status.deviceState.wifiEnabled ? 'ON' : 'OFF'}</span></div>
            </div>
            
            <div class="dashboard-card">
              <h4>⚠️ Issues Detected</h4>
              <div class="status-row"><span class="status-icon ${status.issues.dnsErrors > 0 ? 'error' : 'success'}">${status.issues.dnsErrors > 0 ? '❌' : '✅'}</span><span class="status-label">Network/DNS Errors</span><span class="status-value">${status.issues.dnsErrors}</span></div>
              <div class="status-row"><span class="status-icon ${status.issues.uncleanStartups > 5 ? 'error' : status.issues.uncleanStartups > 0 ? 'warning' : 'success'}">${status.issues.uncleanStartups > 5 ? '❌' : status.issues.uncleanStartups > 0 ? '⚠️' : '✅'}</span><span class="status-label">App Crashes/Kills</span><span class="status-value">${status.issues.uncleanStartups}</span></div>
              <div class="status-row"><span class="status-icon ${status.issues.jobSiteBlocks > 0 ? 'error' : 'success'}">${status.issues.jobSiteBlocks > 0 ? '❌' : '✅'}</span><span class="status-label">Job Site Blocks</span><span class="status-value">${status.issues.jobSiteBlocks}</span></div>
            </div>
          </div>
        </div>
      `;
      
      $('deviceDashboard').innerHTML = html;
      $('deviceDashboard').style.display = 'block';
    }

    // === VISIT HISTORY RENDERING ===
    function renderVisitHistory(data) {
      const container = $('visitHistorySection');
      if (!container) return;
      
      if (!data.geofenceEvents || data.geofenceEvents.length === 0) {
        container.innerHTML = '';
        return;
      }
      
      const uniqueSites = [...new Map(data.jobSites.map(s => [s.id, s])).values()];
      
      const visits = data.geofenceEvents.map(evt => {
        const nearestSite = uniqueSites.length > 0 ? findNearestSite(evt.lat, evt.lng, uniqueSites) : null;
        const isInside = nearestSite ? (nearestSite.distance <= nearestSite.radius) : false;
        
        let accuracyClass = 'good';
        if (evt.accuracy > 50) accuracyClass = 'poor';
        else if (evt.accuracy > 20) accuracyClass = 'fair';
        
        return { ...evt, nearestSite, isInside, accuracyClass };
      });
      
      const enterCount = visits.filter(v => v.type === 'ENTER').length;
      const exitCount = visits.filter(v => v.type === 'EXIT').length;
      const neverInside = visits.filter(v => v.type === 'ENTER' && !v.isInside).length;
      
      let html = `
        <div class="visit-history-box">
          <h4>🕐 Job Site Visit History <span style="font-weight:normal; font-size:11px; color:var(--muted);">(Geofence events with map links)</span></h4>
          <div class="visit-stats">
            <div class="stat"><span class="stat-value">${enterCount}</span><span class="stat-label">Boundary Entries</span></div>
            <div class="stat"><span class="stat-value">${exitCount}</span><span class="stat-label">Boundary Exits</span></div>
            ${neverInside > 0 ? `<div class="stat"><span class="stat-value radius-small">⚠️ ${neverInside}</span><span class="stat-label">Entries outside site radius</span></div>` : ''}
          </div>
          
          <div style="max-height:350px; overflow-y:auto;">
            ${visits.slice(0, 30).map(v => `
              <div class="visit-entry ${v.type.toLowerCase()}">
                <span class="visit-icon">${v.type === 'ENTER' ? '📍' : '🚶'}</span>
                <div class="visit-details">
                  <div class="visit-time">${v.type === 'ENTER' ? 'Entered geofence boundary' : 'Exited geofence boundary'} — ${fmtDate(v.ts)}</div>
                  <div class="visit-coords">
                    <span>User at: <strong>${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}</strong></span>
                    ${generateMapLink(v.lat, v.lng, 'View User Location')}
                  </div>
                  
                  ${v.nearestSite ? `
                    <div class="visit-site-info">
                      <div class="visit-site-name">📌 Nearest configured site: ${escapeHtml(v.nearestSite.name)}</div>
                      <div class="visit-coords" style="margin-top:4px;">
                        <span>Site at: ${v.nearestSite.lat.toFixed(6)}, ${v.nearestSite.lng.toFixed(6)}</span>
                        ${generateMapLink(v.nearestSite.lat, v.nearestSite.lng, 'View Site Location')}
                      </div>
                      <div class="visit-distance ${v.isInside ? 'inside' : 'outside'}">
                        ${v.isInside 
                          ? `✅ Within radius: ${v.nearestSite.distance}m away (site radius: ${v.nearestSite.radius}m)`
                          : `⚠️ OUTSIDE radius: ${v.nearestSite.distance}m away (site radius: ${v.nearestSite.radius}m) — ${v.nearestSite.distance - v.nearestSite.radius}m outside boundary`
                        }
                      </div>
                      <div class="location-comparison">
                        <div class="compare-row">
                          <span class="compare-label">User → Site distance:</span>
                          <span class="compare-value">${v.nearestSite.distance.toLocaleString()}m</span>
                        </div>
                        <div class="compare-row">
                          <span class="compare-label">Site radius:</span>
                          <span class="compare-value">${v.nearestSite.radius}m</span>
                        </div>
                        <div class="compare-row">
                          <span class="compare-label">GPS accuracy:</span>
                          <span class="compare-value">±${v.accuracy ? Math.round(v.accuracy) : '?'}m</span>
                        </div>
                      </div>
                    </div>
                  ` : `
                    <div class="visit-site-info">
                      <div style="color:var(--warn);">⚠️ No job sites configured in logs to compare against</div>
                    </div>
                  `}
                </div>
                <span class="visit-accuracy ${v.accuracyClass}">±${v.accuracy ? Math.round(v.accuracy) : '?'}m</span>
              </div>
            `).join('')}
            ${visits.length > 30 ? `<div style="text-align:center; padding:10px; color:var(--muted); font-size:11px;">... and ${visits.length - 30} more events</div>` : ''}
          </div>
        </div>
      `;
      
      container.innerHTML = html;
    }

    // === ROOT CAUSE CONCLUSION GENERATION ===
    function generateRootCauseConclusion(status, data) {
      const dominated = []; // Issues sorted by severity/likelihood
      const evidence = [];
      const actionSteps = [];
      
      // === ANALYZE AND RANK ISSUES ===
      
      // 1. Job Site Blocks (user's direct complaint usually)
      if (status.issues.jobSiteBlocks > 0) {
        // Check for small radius sites
        const geofenceLines = allLines.filter(l => l.includes('creating geofence') && !l.includes('id=-'));
        const radiusMatches = geofenceLines.map(l => {
          const m = l.match(/,\s*(\d+)\)$/);
          return m ? parseInt(m[1]) : null;
        }).filter(r => r !== null);
        const smallRadiusCount = radiusMatches.filter(r => r <= 50).length;
        const totalSites = new Set(geofenceLines.map(l => {
          const m = l.match(/id=(\d+)/);
          return m ? m[1] : null;
        })).size;
        
        let radiusNote = '';
        if (smallRadiusCount > totalSites * 0.5) {
          radiusNote = ` <strong>Note:</strong> ${smallRadiusCount} of ${totalSites} sites have a 50m radius, which may be too small for reliable detection indoors.`;
        }
        
        dominated.push({
          severity: 10,
          cause: "the user is <strong>not being detected at a job site</strong>",
          detail: `The timer was blocked ${status.issues.jobSiteBlocks} time(s) because the system determined the user wasn't at a configured job site.${radiusNote}`
        });
        evidence.push(`Timer blocked ${status.issues.jobSiteBlocks}x with "requires being at a job site" error`);
        if (smallRadiusCount > 0) {
          evidence.push(`${smallRadiusCount} job sites have 50m radius (may be too small)`);
          actionSteps.push("Consider increasing job site radius to 100-150m for better indoor detection");
        }
      }
      
      // 2. Network/DNS Issues (prevents everything)
      if (status.issues.dnsErrors > 10) {
        dominated.push({
          severity: 9,
          cause: "<strong>no internet connection</strong> during key moments",
          detail: `Found ${status.issues.dnsErrors} DNS/network failures. Without internet, the app cannot verify job site status or start tracking, even if GPS shows the correct location.`
        });
        evidence.push(`${status.issues.dnsErrors} DNS resolution failures (Could not resolve host)`);
        actionSteps.push("Check if WiFi/mobile data was working during the issue");
        actionSteps.push("Try switching between WiFi and cellular data");
        actionSteps.push("Restart the device to reset network connections");
      }
      
      // 3. Not Primary Device
      if (status.location.isPrimary === false) {
        dominated.push({
          severity: 8,
          cause: "this device is <strong>not set as the primary device</strong>",
          detail: "Only the primary device can record locations and trigger job site automations. The user may have logged in on another device."
        });
        evidence.push("Device reports primary: false");
        actionSteps.push("User should tap 'Make Primary' banner on the Timer screen");
        actionSteps.push("Or check Admin → User page to see which device is primary");
      }
      
      // 4. Battery Optimization Killing App
      if (status.deviceState.batteryOptDisabled === false && status.issues.uncleanStartups > 5) {
        dominated.push({
          severity: 8,
          cause: "<strong>Android is killing the app</strong> to save battery",
          detail: `Battery optimization is ON and the app crashed/was killed ${status.issues.uncleanStartups} times. Android is aggressively closing Hubstaff in the background.`
        });
        evidence.push(`Battery optimization is ENABLED (isIgnoringBatteryOptimization: false)`);
        evidence.push(`${status.issues.uncleanStartups} unclean startups (app was killed)`);
        actionSteps.push("Disable battery optimization: Settings → Apps → Hubstaff → Battery → Unrestricted");
        if (status.device.manufacturer?.toLowerCase() === 'samsung') {
          actionSteps.push("Samsung: Also remove from 'Sleeping apps' and 'Deep sleeping apps' lists");
        }
      } else if (status.issues.uncleanStartups > 10) {
        dominated.push({
          severity: 7,
          cause: "the <strong>app is repeatedly crashing or being killed</strong>",
          detail: `Found ${status.issues.uncleanStartups} unclean startups. The app is not staying running in the background.`
        });
        evidence.push(`${status.issues.uncleanStartups} STARTUP_UNCLEAN events`);
        actionSteps.push("Check battery optimization settings");
        actionSteps.push("Check if user is manually force-closing the app");
      }
      
      // 5. Background Location Permission
      if (status.permissions.backgroundLocation === false) {
        dominated.push({
          severity: 8,
          cause: "<strong>background location permission is not granted</strong>",
          detail: "The app can only access location while on screen. Job site detection requires 'Allow all the time' permission."
        });
        evidence.push("BACKGROUND_LOCATION permission is disabled");
        actionSteps.push("Settings → Apps → Hubstaff → Permissions → Location → 'Allow all the time'");
      }
      
      // 6. Location Services Disabled
      if (status.location.servicesEnabled === false) {
        dominated.push({
          severity: 9,
          cause: "<strong>location services are disabled</strong> on the device",
          detail: "The device's location services are turned off. GPS cannot work at all."
        });
        evidence.push("SERVICES_ENABLED is false in locationState");
        actionSteps.push("Enable Location Services in device Settings");
      }
      
      // 7. Battery optimization without crashes (potential future issue)
      if (status.deviceState.batteryOptDisabled === false && status.issues.uncleanStartups <= 5) {
        dominated.push({
          severity: 4,
          cause: "<strong>battery optimization is enabled</strong> (potential issue)",
          detail: "Battery optimization is ON. While not causing crashes yet, this may cause issues with background tracking."
        });
        evidence.push("isIgnoringBatteryOptimization: false");
        actionSteps.push("Recommend disabling battery optimization as a preventive measure");
      }
      
      // 8. Job Site / Geofence Analysis
      if (data.geofenceEvents && data.geofenceEvents.length > 0) {
        const uniqueSites = [...new Map(data.jobSites.map(s => [s.id, s])).values()];
        
        // Analyze each geofence event
        let outsideRadiusCount = 0;
        let poorAccuracyCount = 0;
        let enterEvents = 0;
        let exitEvents = 0;
        const outsideDetails = [];
        
        data.geofenceEvents.forEach(evt => {
          if (evt.type === 'ENTER') enterEvents++;
          if (evt.type === 'EXIT') exitEvents++;
          
          if (evt.accuracy && evt.accuracy > 50) poorAccuracyCount++;
          
          if (uniqueSites.length > 0) {
            const nearest = findNearestSite(evt.lat, evt.lng, uniqueSites);
            if (nearest && nearest.distance > nearest.radius) {
              outsideRadiusCount++;
              const outsideBy = nearest.distance - nearest.radius;
              outsideDetails.push(`${evt.type} event ${nearest.distance}m from "${nearest.name}" (radius: ${nearest.radius}m, ${outsideBy}m outside)`);
            }
          }
        });
        
        // Add findings based on analysis
        if (outsideRadiusCount > 0) {
          dominated.push({
            severity: 7,
            cause: `<strong>user was outside job site radius</strong> during ${outsideRadiusCount} geofence event${outsideRadiusCount > 1 ? 's' : ''}`,
            detail: `The user triggered geofence boundaries but was actually outside the configured site radius. This can happen when: 1) Job site radius is too small, 2) GPS accuracy is poor, 3) The job site pin is in the wrong location.`
          });
          evidence.push(`${outsideRadiusCount} of ${data.geofenceEvents.length} geofence events were outside the nearest site's radius`);
          outsideDetails.slice(0, 3).forEach(d => evidence.push(d));
          actionSteps.push("Check the Locations section for map links to compare user position vs site location");
          actionSteps.push("Consider increasing job site radius to 100-150m");
        }
        
        if (poorAccuracyCount > data.geofenceEvents.length * 0.5) {
          dominated.push({
            severity: 5,
            cause: "<strong>GPS accuracy was poor</strong> during location events",
            detail: `${poorAccuracyCount} of ${data.geofenceEvents.length} location events had accuracy worse than 50m. Poor GPS signal makes job site detection unreliable.`
          });
          evidence.push(`${poorAccuracyCount} events with GPS accuracy >50m`);
          actionSteps.push("User should try going outdoors with clear sky view for better GPS");
          actionSteps.push("Check if device has 'High Accuracy' location mode enabled");
        }
        
        // Add summary even if no issues
        if (outsideRadiusCount === 0 && enterEvents > 0) {
          evidence.push(`✓ ${enterEvents} site entry event${enterEvents > 1 ? 's' : ''} detected, all within configured radius`);
        }
      }
      
      // 9. Job Sites Configuration Issues
      if (data.jobSites && data.jobSites.length > 0) {
        const uniqueSites = [...new Map(data.jobSites.map(s => [s.id, s])).values()];
        const smallRadiusSites = uniqueSites.filter(s => s.radius <= 50);
        
        if (smallRadiusSites.length > uniqueSites.length * 0.5) {
          dominated.push({
            severity: 5,
            cause: `<strong>${smallRadiusSites.length} of ${uniqueSites.length} job sites have small radius</strong> (≤50m)`,
            detail: "A 50m radius is often too small for reliable detection, especially indoors where GPS accuracy is reduced. This frequently causes 'not at job site' errors even when the user is physically present."
          });
          evidence.push(`${smallRadiusSites.length} sites configured with ≤50m radius`);
          actionSteps.push("Increase job site radius to 100-150m for more reliable detection");
        }
      }
      
      // 10. No geofence events but job site blocks
      if (status.issues.jobSiteBlocks > 0 && (!data.geofenceEvents || data.geofenceEvents.length === 0)) {
        evidence.push("⚠️ Timer was blocked for job site reasons but no geofence events found in logs");
        actionSteps.push("Enable 'Show DEBUG level' to see detailed location data");
        actionSteps.push("Check if location permissions are set to 'Always' (not 'While Using')");
      }
      
      // Sort by severity
      dominated.sort((a, b) => b.severity - a.severity);
      
      // === BUILD CONCLUSION ===
      if (dominated.length === 0) {
        // No issues found
        return {
          isSuccess: true,
          html: `
            <div class="root-cause-box success">
              <h3>✅ No Major Issues Detected</h3>
              <div class="conclusion">
                Based on the log analysis, <strong>all device settings and permissions appear to be correctly configured</strong>. 
                The app should be functioning normally for location tracking and job site detection.
              </div>
              <div class="evidence">
                <h4>✓ Verified Working:</h4>
                <ul>
                  ${status.location.isPrimary !== false ? '<li>Device is set as primary</li>' : ''}
                  ${status.location.servicesEnabled ? '<li>Location services are enabled</li>' : ''}
                  ${status.permissions.backgroundLocation !== false ? '<li>Background location permission granted</li>' : ''}
                  ${status.deviceState.batteryOptDisabled !== false ? '<li>Battery optimization is disabled</li>' : ''}
                  ${status.issues.dnsErrors === 0 ? '<li>No network connectivity issues</li>' : ''}
                </ul>
              </div>
              <div class="action-steps">
                <h4>💡 If the user is still experiencing issues:</h4>
                <ol>
                  <li>Ask for more specific details about what's happening</li>
                  <li>Check if the job site radius is large enough (recommend 100-150m)</li>
                  <li>Verify the job site pin is in the correct location on the map</li>
                  <li>Check GPS signal quality - try going outdoors with clear sky</li>
                </ol>
              </div>
            </div>
          `
        };
      }
      
      // Build HTML for issues found
      const topCause = dominated[0];
      const secondaryCauses = dominated.slice(1, 3).filter(d => d.severity >= 5);
      
      let conclusionText = `Based on the log analysis, the issue is most likely caused by ${topCause.cause}.`;
      if (secondaryCauses.length > 0) {
        conclusionText += ` Contributing factors may include: ${secondaryCauses.map(d => d.cause).join(', ')}.`;
      }
      
      // Add specific context for job site + network combo (very common)
      if (status.issues.jobSiteBlocks > 0 && status.issues.dnsErrors > 5) {
        conclusionText += `<br><br><strong>Key insight:</strong> The user may have been physically at the job site, but the app couldn't verify this because there was no internet connection. Even with perfect GPS, the app needs network access to start tracking.`;
      }
      
      return {
        isSuccess: false,
        html: `
          <div class="root-cause-box">
            <h3>🔍 Root Cause Analysis</h3>
            <div class="conclusion">${conclusionText}</div>
            <div class="evidence">
              <h4>📋 Evidence from logs:</h4>
              <ul>
                ${evidence.map(e => `<li>${e}</li>`).join('')}
              </ul>
            </div>
            ${actionSteps.length > 0 ? `
            <div class="action-steps">
              <h4>💡 Recommended Actions:</h4>
              <ol>
                ${actionSteps.map(a => `<li>${a}</li>`).join('')}
              </ol>
            </div>
            ` : ''}
          </div>
        `
      };
    }

