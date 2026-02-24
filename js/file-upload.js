    function search(query) {
      if (!query.trim()) {
        $('searchBody').innerHTML = '<tr><td colspan="4" style="color:var(--muted)">Enter a search term above</td></tr>';
        $('searchCount').textContent = '0';
        return;
      }

      const q = query.toLowerCase();
      const results = allLines.filter(line => line.toLowerCase().includes(q));

      $('searchCount').textContent = results.length;
      
      // Auto-expand search section when searching
      expandSection('search');

      if (!results.length) {
        $('searchBody').innerHTML = `<tr><td colspan="4" style="color:var(--muted)">No results for "${escapeHtml(query)}"</td></tr>`;
        return;
      }

      createVirtualTable('search', 'searchBody', results, (line) => {
        const ts = parseTimestamp(line);
        const level = parseLevel(line);
        const src = parseSource(line);
        const msg = parseMessage(line);
        const highlightedMsg = escapeHtml(msg).replace(new RegExp(`(${escapeHtml(query)})`, 'gi'), '<mark class="highlight">$1</mark>');
        return `
          <tr>
            <td style="white-space:nowrap;">${fmtTime(ts)}</td>
            <td>${renderLevelTag(level)}</td>
            <td style="font-size:10px;color:var(--muted);max-width:100px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(src)}</td>
            <td style="font-size:11px;">${highlightedMsg}</td>
          </tr>
        `;
      }, 'No results found');
    }

    // ========== FILE UPLOAD HANDLING ==========
    let uploadedFileContent = null;
    
    // Input method toggle
    $('uploadMethodBtn').onclick = () => {
      $('uploadMethodBtn').classList.add('active');
      $('pasteMethodBtn').classList.remove('active');
      $('uploadSection').classList.add('active');
      $('pasteSection').classList.remove('active');
    };
    
    $('pasteMethodBtn').onclick = () => {
      $('pasteMethodBtn').classList.add('active');
      $('uploadMethodBtn').classList.remove('active');
      $('pasteSection').classList.add('active');
      $('uploadSection').classList.remove('active');
    };
    
    // File upload area click
    $('fileUploadArea').onclick = () => $('fileInput').click();
    
    // Drag and drop
    $('fileUploadArea').ondragover = (e) => {
      e.preventDefault();
      $('fileUploadArea').classList.add('drag-over');
    };
    
    $('fileUploadArea').ondragleave = () => {
      $('fileUploadArea').classList.remove('drag-over');
    };
    
    $('fileUploadArea').ondrop = (e) => {
      e.preventDefault();
      $('fileUploadArea').classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 1) {
        handleMultiFileUpload(files);
      } else if (files.length === 1) {
        handleFileUpload(files[0]);
      }
    };
    
    // File input change
    $('fileInput').onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 1) {
        handleMultiFileUpload(files);
      } else if (files.length === 1) {
        handleFileUpload(files[0]);
      }
    };
    
    // Handle file upload with chunked reading for large files
    function handleFileUpload(file) {
      const fileName = file.name;
      const fileSize = file.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      
      $('fileName').textContent = `📎 ${fileName} (${fileSizeMB} MB)`;
      $('fileName').classList.add('visible');
      $('progressContainer').classList.add('visible');
      $('progressBar').style.width = '0%';
      $('progressText').textContent = 'Reading file...';
      $('status').textContent = '';
      
      // For very large files (>5MB), read in chunks
      if (fileSize > 5 * 1024 * 1024) {
        readFileInChunks(file);
      } else {
        // Small files - read directly
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            $('progressBar').style.width = pct + '%';
            $('progressText').textContent = `Reading: ${pct}%`;
          }
        };
        reader.onload = (e) => {
          uploadedFileContent = e.target.result;
          $('progressBar').style.width = '100%';
          $('progressText').textContent = `✓ File loaded (${countLines(uploadedFileContent).toLocaleString()} lines) - Click Analyze`;
          $('status').textContent = 'File ready - click Analyze';
          $('status').className = 'status success';
        };
        reader.onerror = () => {
          $('progressText').textContent = '❌ Error reading file';
          $('status').textContent = 'Error reading file';
          $('status').className = 'status error';
        };
        reader.readAsText(file);
      }
    }
    
    // Read large files in chunks to prevent memory issues
    function readFileInChunks(file) {
      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
      let offset = 0;
      let content = '';
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        content += e.target.result;
        offset += CHUNK_SIZE;
        
        const pct = Math.min(100, Math.round((offset / file.size) * 100));
        $('progressBar').style.width = pct + '%';
        $('progressText').textContent = `Reading: ${pct}% (${(offset / (1024 * 1024)).toFixed(1)} MB)`;
        
        if (offset < file.size) {
          readNextChunk();
        } else {
          uploadedFileContent = content;
          $('progressBar').style.width = '100%';
          $('progressText').textContent = `✓ File loaded (${countLines(content).toLocaleString()} lines) - Click Analyze`;
          $('status').textContent = 'File ready - click Analyze';
          $('status').className = 'status success';
        }
      };
      
      reader.onerror = () => {
        $('progressText').textContent = '❌ Error reading file';
        $('status').textContent = 'Error reading file';
        $('status').className = 'status error';
      };
      
      function readNextChunk() {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsText(slice);
      }
      
      readNextChunk();
    }

    // Handle multiple file uploads - reads all, sorts by date, combines
    function handleMultiFileUpload(files) {
      const fileArray = Array.from(files);
      const totalFiles = fileArray.length;
      const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

      $('fileName').textContent = `📎 ${totalFiles} files selected (${totalSizeMB} MB total)`;
      $('fileName').classList.add('visible');
      $('progressContainer').classList.add('visible');
      $('progressBar').style.width = '0%';
      $('progressText').textContent = `Reading ${totalFiles} files...`;
      $('status').textContent = '';

      let filesRead = 0;
      const fileContents = [];

      fileArray.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          // Extract first timestamp from file to determine date order
          const firstTimestamp = extractFirstTimestamp(content);
          fileContents.push({
            name: file.name,
            content: content,
            firstTimestamp: firstTimestamp,
            size: file.size
          });

          filesRead++;
          const pct = Math.round((filesRead / totalFiles) * 100);
          $('progressBar').style.width = pct + '%';
          $('progressText').textContent = `Reading: ${filesRead}/${totalFiles} files (${pct}%)`;

          // All files read - sort and combine
          if (filesRead === totalFiles) {
            // Sort by first timestamp (oldest first)
            fileContents.sort((a, b) => {
              if (!a.firstTimestamp && !b.firstTimestamp) return 0;
              if (!a.firstTimestamp) return 1;
              if (!b.firstTimestamp) return -1;
              return a.firstTimestamp - b.firstTimestamp;
            });

            // Combine with separator comments showing file boundaries
            const combined = fileContents.map(f => {
              const dateStr = f.firstTimestamp ? new Date(f.firstTimestamp).toISOString().split('T')[0] : 'unknown date';
              return `// === FILE: ${f.name} (starts ${dateStr}) ===\n${f.content}`;
            }).join('\n');

            uploadedFileContent = combined;
            const lineCount = countLines(combined);

            $('progressBar').style.width = '100%';
            const fileList = fileContents.map(f => f.name).join(', ');
            $('progressText').textContent = `✓ ${totalFiles} files loaded in date order (${lineCount.toLocaleString()} lines) - Click Analyze`;
            $('fileName').innerHTML = `📎 ${totalFiles} files (${totalSizeMB} MB) — sorted: ${fileContents.map(f => '<strong>' + f.name + '</strong>').join(' → ')}`;
            $('status').textContent = `${totalFiles} files merged in chronological order — click Analyze`;
            $('status').className = 'status success';
          }
        };
        reader.onerror = () => {
          filesRead++;
          $('progressText').textContent = `⚠️ Error reading ${file.name}, continuing...`;
        };
        reader.readAsText(file);
      });
    }

    // Extract first valid timestamp from log content
    function extractFirstTimestamp(content) {
      // Check first 20 lines for a timestamp
      const lines = content.split('\n', 20);
      for (const line of lines) {
        const ts = parseTimestamp(line);
        if (ts) return ts;
      }
      return null;
    }
    
    function countLines(text) {
      let count = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') count++;
      }
      return count + 1;
    }
    
    // Chunked analysis for large files
    function analyzeInChunks(text, callback) {
      const lines = text.split(/\r?\n/);
      const totalLines = lines.length;
      const CHUNK_SIZE = 10000; // Process 10k lines at a time
      let processedLines = 0;
      let filteredLines = [];
      
      $('progressContainer').classList.add('visible');
      $('progressBar').style.width = '0%';
      
      function processChunk() {
        const chunk = lines.slice(processedLines, processedLines + CHUNK_SIZE);
        
        if ($('autoFilter').checked) {
          filteredLines = filteredLines.concat(filterLogs(chunk));
        } else {
          filteredLines = filteredLines.concat(chunk);
        }
        
        processedLines += chunk.length;
        const pct = Math.round((processedLines / totalLines) * 100);
        $('progressBar').style.width = pct + '%';
        $('progressText').textContent = `Processing: ${processedLines.toLocaleString()} / ${totalLines.toLocaleString()} lines (${pct}%)`;
        
        if (processedLines < totalLines) {
          // Use setTimeout to allow UI to update
          setTimeout(processChunk, 0);
        } else {
          // Done processing
          $('progressText').textContent = 'Analyzing...';
          
          // Use setTimeout to let the UI update before heavy analysis
          setTimeout(() => {
            const originalCount = totalLines;
            const filteredCount = filteredLines.length;
            const removedCount = originalCount - filteredCount;
            const pctRemoved = originalCount > 0 ? ((removedCount / originalCount) * 100).toFixed(1) : 0;
            
            if ($('autoFilter').checked) {
              $('filterStats').style.display = 'block';
              $('filterStatsText').innerHTML = `🔮 <strong>Filtered:</strong> ${originalCount.toLocaleString()} → ${filteredCount.toLocaleString()} lines (removed ${removedCount.toLocaleString()} noise lines, ${pctRemoved}%)`;
            } else {
              $('filterStats').style.display = 'none';
            }
            
            fullParsedData = analyze(filteredLines.join('\n'));
            parsedData = filterByDate(fullParsedData);
            render(parsedData);
            
            $('progressContainer').classList.remove('visible');
            $('status').textContent = `✓ Analyzed ${parsedData.total.toLocaleString()} lines`;
            $('status').className = 'status success';
            
            if (callback) callback();
          }, 10);
        }
      }
      
      processChunk();
    }

    $('analyzeBtn').onclick = () => {
      // Check if we have uploaded file content or pasted text
      const isUploadMode = $('uploadSection').classList.contains('active');
      let text;
      
      if (isUploadMode) {
        if (!uploadedFileContent) {
          $('status').textContent = 'Please upload a file first';
          $('status').className = 'status error';
          return;
        }
        text = uploadedFileContent;
      } else {
        text = $('logInput').value;
        if (!text.trim()) {
          $('status').textContent = 'Please paste log content first';
          $('status').className = 'status error';
          return;
        }
      }

      const lineCount = countLines(text);
      
      // Use chunked processing for large files (>50k lines)
      if (lineCount > 50000) {
        $('status').textContent = 'Processing large file...';
        $('status').className = 'status';
        analyzeInChunks(text);
        return;
      }
      
      // Standard processing for smaller files
      let lines = text.split(/\r?\n/);
      const originalCount = lines.filter(l => l.trim()).length;
      
      if ($('autoFilter').checked) {
        lines = filterLogs(lines);
        const filteredCount = lines.length;
        const removedCount = originalCount - filteredCount;
        const pct = originalCount > 0 ? ((removedCount / originalCount) * 100).toFixed(1) : 0;
        $('filterStats').style.display = 'block';
        $('filterStatsText').innerHTML = `🔮 <strong>Filtered:</strong> ${originalCount.toLocaleString()} → ${filteredCount.toLocaleString()} lines (removed ${removedCount.toLocaleString()} noise lines, ${pct}%)`;
      } else {
        $('filterStats').style.display = 'none';
      }

      fullParsedData = analyze(lines.join('\n'));
      parsedData = filterByDate(fullParsedData);
      render(parsedData);
      $('status').textContent = `Analyzed ${parsedData.total.toLocaleString()} lines`;
      $('status').className = 'status success';
    };

    $('clearBtn').onclick = () => {
      $('logInput').value = '';
      $('searchInput').value = '';
      allLines = [];
      parsedData = null;
      timelineMin = null;
      timelineDur = null;
      // Cleanup virtual scroll listeners
      Object.keys(virtualTableInstances).forEach(k => {
        const inst = virtualTableInstances[k];
        if (inst.scrollHandler) inst.wrap.removeEventListener('scroll', inst.scrollHandler);
        delete virtualTableInstances[k];
      });
      render(null);
      $('timelineSection').style.display = 'none';
      $('filterStats').style.display = 'none';
      $('deviceDashboard').style.display = 'none';
      $('silentAppDashboard').style.display = 'none';
      $('silentAppDashboard').innerHTML = '';
      $('rootCauseCard').style.display = 'none';
      $('visitHistorySection').innerHTML = '';
      $('dateFrom').value = '';
      $('dateTo').value = '';
      $('tzOffset').value = '';
      $('tzLabel').textContent = '';
      fullParsedData = null;
      hideInfoBox();
      // Clear file upload state
      uploadedFileContent = null;
      $('fileInput').value = '';
      $('fileName').textContent = '';
      $('fileName').classList.remove('visible');
      $('progressContainer').classList.remove('visible');
      $('progressBar').style.width = '0%';
      $('status').textContent = '🔒 All data cleared';
      $('status').className = 'status success';
      setTimeout(() => { $('status').textContent = ''; }, 2000);
    };

    $('searchBtn').onclick = () => search($('searchInput').value);
    $('searchInput').onkeydown = e => { if (e.key === 'Enter') search($('searchInput').value); };
    $('clearSearchBtn').onclick = () => {
      $('searchInput').value = '';
      $('searchBody').innerHTML = '<tr><td colspan="4" style="color:var(--muted)">Enter a search term above</td></tr>';
    };

    $('showDebug').onchange = () => { if (parsedData) { parsedData = analyze($('logInput').value); render(parsedData); } };
    $('showTrace').onchange = () => { if (parsedData) { parsedData = analyze($('logInput').value); render(parsedData); } };
    $('plainMode').onchange = () => { if (parsedData) render(parsedData); };

    // Timezone controls
    $('tzOffset').oninput = () => { 
      updateTzLabel(); 
      if ($('userTzMode').checked && fullParsedData) {
        parsedData = filterByDate(fullParsedData);
        render(parsedData);
      }
    };
    $('userTzMode').onchange = () => {
      if ($('userTzMode').checked && userTzOffsetMs === null) {
        $('tzOffset').focus();
        $('tzOffset').style.borderColor = 'var(--warn)';
        setTimeout(() => { $('tzOffset').style.borderColor = ''; }, 1500);
      }
      if (fullParsedData) {
        parsedData = filterByDate(fullParsedData);
        render(parsedData);
      }
    };
    
    // Date filter controls
    $('dateFrom').onchange = () => { 
      if (fullParsedData) { 
        parsedData = filterByDate(fullParsedData); 
        render(parsedData); 
      } 
    };
    $('dateTo').onchange = () => { 
      if (fullParsedData) { 
        parsedData = filterByDate(fullParsedData); 
        render(parsedData); 
      } 
    };
    $('clearDates').onclick = () => { 
      $('dateFrom').value = ''; 
      $('dateTo').value = ''; 
      if (fullParsedData) { 
        parsedData = filterByDate(fullParsedData); 
        render(parsedData); 
      } 
    };

    // Toggle technical details in summary
    window.toggleTech = function(idx) {
      const el = $('tech-' + idx);
      if (el) el.classList.toggle('visible');
    };

    // Toggle collapsible sections
    window.toggleSection = function(section) {
      const header = document.querySelector(`#${section}Content`).previousElementSibling;
      const content = $(`${section}Content`);
      header.classList.toggle('collapsed');
      content.classList.toggle('collapsed');
    };

    // Toggle filter details
    window.toggleFilterDetails = function() {
      const details = $('filterDetails');
      const toggle = $('filterDetailsToggle');
      if (details.style.display === 'none') {
        details.style.display = 'block';
        toggle.textContent = 'Hide details';
      } else {
        details.style.display = 'none';
        toggle.textContent = 'What was removed?';
      }
    };

    // Expand section (used when searching)
    function expandSection(section) {
      const header = document.querySelector(`#${section}Content`).previousElementSibling;
      const content = $(`${section}Content`);
      header.classList.remove('collapsed');
      content.classList.remove('collapsed');
    }

   // Help Guide functionality
    $('helpGuideBtn').onclick = () => $('helpModal').classList.add('visible');
    $('closeHelp').onclick = () => $('helpModal').classList.remove('visible');
    $('helpModal').onclick = e => { if (e.target === $('helpModal')) $('helpModal').classList.remove('visible'); };

    // Help Guide navigation
    document.querySelectorAll('.help-nav-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.help-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.help-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const section = document.getElementById('help-' + btn.dataset.section);
        if (section) section.classList.add('active');
      };
    });

    $('privacyBtn').onclick = () => $('privacyModal').classList.add('visible');
    $('closePrivacy').onclick = () => $('privacyModal').classList.remove('visible');
    $('privacyModal').onclick = e => { if (e.target === $('privacyModal')) $('privacyModal').classList.remove('visible'); };

    // Timeline zoom controls
    $('zoomSlider').oninput = function() {
      $('timelineContent').style.width = (this.value * 100) + '%';
    };

    $('resetZoom').onclick = () => {
      $('zoomSlider').value = 1;
      $('timelineContent').style.width = '100%';
      $('timelineContainer').scrollLeft = 0;
      hideInfoBox();
    };

    // Close info box on click outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.info-box') && !e.target.closest('.t-marker')) {
        hideInfoBox();
      }
    });

    // Timeline track toggles
    const trackToggles = [
      { toggle: 'togErrors', label: 'labelErrors', track: 'trackErrors' },
      { toggle: 'togWarnings', label: 'labelWarnings', track: 'trackWarnings' },
      { toggle: 'togScreenshots', label: 'labelScreenshots', track: 'trackScreenshots' },
      { toggle: 'togNetwork', label: 'labelNetwork', track: 'trackNetwork' },
      { toggle: 'togLocation', label: 'labelLocation', track: 'trackLocation' },
      { toggle: 'togTracking', label: 'labelTracking', track: 'trackTracking' },
    ];

    trackToggles.forEach(({ toggle, label, track }) => {
      $(toggle).onchange = function() {
        const isVisible = this.checked;
        $(label).classList.toggle('hidden', !isVisible);
        $(track).classList.toggle('hidden', !isVisible);
        this.parentElement.classList.toggle('disabled', !isVisible);
      };
    });

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        $('analyzeBtn').click();
      }
    });

    // Clear all data when page is closed
    window.addEventListener('beforeunload', () => {
      $('logInput').value = '';
      if (allLines) allLines.length = 0;
      if (parsedData) {
        if (parsedData.errors) parsedData.errors.length = 0;
        if (parsedData.warnings) parsedData.warnings.length = 0;
        if (parsedData.screenshots) parsedData.screenshots.length = 0;
        if (parsedData.network) parsedData.network.length = 0;
        if (parsedData.locations) parsedData.locations.length = 0;
        if (parsedData.apps) parsedData.apps.length = 0;
        if (parsedData.tracking) parsedData.tracking.length = 0;
        if (parsedData.sessions) parsedData.sessions.length = 0;
        if (parsedData.idleDecisions) parsedData.idleDecisions.length = 0;
      }
      parsedData = null;
      allLines = [];
    });
