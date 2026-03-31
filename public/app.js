// ─── SalesGenie Dashboard ───────────────────────────────────────────
// Client-side logic for the VIN Sales Intelligence dashboard

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  let selectedPersonality = 'Analytical';
  let isScanning = false;
  let editingRepId = null;

  // ── DOM Elements ──────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const vinInput = $('#vin-input');
  const vinError = $('#vin-error');
  const scanBtn = $('#scan-btn');
  const decodeBtn = $('#decode-btn');
  const pipelinePanel = $('#pipeline-panel');
  const pipelineLog = $('#pipeline-log');
  const pipelineTime = $('#pipeline-time');
  const resultsGrid = $('#results-grid');
  const statusDot = $('#status-dot');
  const statusText = $('#status-text');

  // ── Health Check ──────────────────────────────────────────────────
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health Check HTTP ' + res.status);
      const data = await res.json();
      if (data.status === 'ok') {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        statusText.textContent = data.geminiConfigured ? 'All Systems Go' : 'Gemini Key Missing';
      } else {
        throw new Error('Health Check Status Not OK');
      }
    } catch (err) {
      console.error('Health Check Error:', err);
      statusDot.classList.add('offline');
      statusText.textContent = 'Offline';
    }
  }

  // ── Pipeline Logging ──────────────────────────────────────────────
  function clearLog() {
    pipelineLog.innerHTML = '';
  }

  function addLog(icon, text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="log-icon"><i class="fas fa-${icon}"></i></span>
      <span class="log-text">${text}</span>
    `;
    pipelineLog.appendChild(entry);
    pipelineLog.scrollTop = pipelineLog.scrollHeight;
  }

  function addSpinner(text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry info';
    entry.id = 'spinner-entry';
    entry.innerHTML = `
      <span class="log-icon"><i class="fas fa-circle-notch spinning"></i></span>
      <span class="log-text">${text}</span>
    `;
    pipelineLog.appendChild(entry);
    pipelineLog.scrollTop = pipelineLog.scrollHeight;
    return entry;
  }

  function removeSpinner() {
    const spinner = $('#spinner-entry');
    if (spinner) spinner.remove();
  }

  // ── VIN Validation ────────────────────────────────────────────────
  function validateVin(vin) {
    if (!vin) return 'VIN is required';
    if (vin.length !== 17) return `VIN must be 17 characters (got ${vin.length})`;
    if (/[IOQ]/i.test(vin)) return 'VIN cannot contain I, O, or Q';
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) return 'VIN contains invalid characters';
    return null;
  }

  // ── Personality Selection ─────────────────────────────────────────
  $$('.personality-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.personality-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPersonality = btn.dataset.type;
    });
  });

  // ── Confidence Badge ──────────────────────────────────────────────
  function confidenceClass(score) {
    if (score >= 75) return 'confidence-high';
    if (score >= 50) return 'confidence-medium';
    return 'confidence-low';
  }

  // ── Render Results ────────────────────────────────────────────────
  function renderVehicle(vehicle) {
    $('#vehicle-title').textContent = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();

    const conf = $('#vehicle-confidence');
    conf.textContent = `${vehicle.confidence || 0}%`;
    conf.className = `confidence-badge ${confidenceClass(vehicle.confidence || 0)}`;

    const specs = [
      ['Engine', `${vehicle.engineDisplacement || '?'}L ${vehicle.engineCylinders || '?'}-cyl`],
      ['Fuel', vehicle.fuelType || 'Unknown'],
      ['Drive', vehicle.driveType || 'Unknown'],
      ['Body', vehicle.bodyClass || 'Unknown'],
      ['Trans', vehicle.transmissionStyle || 'Unknown'],
      ['GVWR', vehicle.gvwr || 'Unknown'],
      ['Origin', vehicle.plantCountry || 'Unknown'],
      ['VIN', vehicle.vin || '—'],
    ];

    $('#vehicle-specs').innerHTML = specs
      .map(([label, value]) => `
        <div class="spec-item">
          <span class="spec-label">${label}</span>
          <span class="spec-value">${value}</span>
        </div>
      `)
      .join('');
  }

  function renderProfile(profile) {
    const colors = {
      Analytical: { bg: 'rgba(34,211,238,0.1)', color: '#22d3ee', icon: 'chart-line' },
      Driver: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', icon: 'bolt' },
      Friendly: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', icon: 'heart' },
      Expressive: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', icon: 'star' },
    };

    const c = colors[profile.primaryType] || colors.Analytical;

    const conf = $('#profile-confidence');
    conf.textContent = `${profile.confidence || 0}%`;
    conf.className = `confidence-badge ${confidenceClass(profile.confidence || 0)}`;

    $('#profile-type').innerHTML = `
      <div class="profile-type-icon" style="background: ${c.bg}; color: ${c.color};">
        <i class="fas fa-${c.icon}"></i>
      </div>
      <span class="profile-type-name" style="color: ${c.color}">${profile.primaryType}</span>
    `;

    let html = '';
    if (profile.buyingMotivators && profile.buyingMotivators.length) {
      html += `<h4>Motivators</h4><ul>${profile.buyingMotivators.map((m) => `<li>${m}</li>`).join('')}</ul>`;
    }
    if (profile.communicationTips && profile.communicationTips.length) {
      html += `<h4>Communication Tips</h4><ul>${profile.communicationTips.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    }
    if (profile.avoidTopics && profile.avoidTopics.length) {
      html += `<h4>Avoid</h4><ul>${profile.avoidTopics.map((a) => `<li>${a}</li>`).join('')}</ul>`;
    }
    $('#profile-details').innerHTML = html;
  }

  function renderMatch(match) {
    const score = $('#match-score');
    score.textContent = `Score: ${match.score}`;
    score.className = `confidence-badge ${confidenceClass(match.score)}`;

    $('#match-details').innerHTML = `
      <div class="match-name">${match.salesperson}</div>
      <div class="match-reason">${match.reason}</div>
      <div class="match-handoff">${match.handoffScript}</div>
    `;
  }

  function renderPitch(pitch) {
    let html = `<div class="pitch-headline">${pitch.headline}</div>`;
    html += `<div class="pitch-body">${pitch.pitch}</div>`;

    // Talking points
    if (pitch.talkingPoints && pitch.talkingPoints.length) {
      html += `<div class="pitch-section">
        <div class="pitch-section-title"><i class="fas fa-list"></i> Talking Points</div>`;
      pitch.talkingPoints.forEach((tp) => {
        html += `<div class="talking-point">
          <div class="talking-point-topic">${tp.topic}</div>
          <div class="talking-point-detail">${tp.point || ''} ${tp.whyItMatters ? '— ' + tp.whyItMatters : ''}</div>
        </div>`;
      });
      html += `</div>`;
    }

    // Objection handlers
    if (pitch.objectionHandlers && pitch.objectionHandlers.length) {
      html += `<div class="pitch-section">
        <div class="pitch-section-title"><i class="fas fa-shield-halved"></i> Objection Handlers</div>`;
      pitch.objectionHandlers.forEach((obj) => {
        html += `<div class="objection">
          <div class="objection-q">"${obj.objection}"</div>
          <div class="objection-a">${obj.response}</div>
          ${obj.technique ? `<div class="objection-technique">${obj.technique}</div>` : ''}
        </div>`;
      });
      html += `</div>`;
    }

    // Closing strategy
    if (pitch.closingStrategy) {
      html += `<div class="pitch-section">
        <div class="pitch-section-title"><i class="fas fa-flag-checkered"></i> Closing Strategy</div>
        <div class="pitch-closing">${pitch.closingStrategy}</div>
      </div>`;
    }

    // Urgency
    if (pitch.urgencyHook) {
      html += `<div class="pitch-section">
        <div class="pitch-section-title"><i class="fas fa-clock"></i> Urgency Hook</div>
        <div class="pitch-urgency">${pitch.urgencyHook}</div>
      </div>`;
    }

    $('#pitch-details').innerHTML = html;
  }

  // ── Scan Pipeline ─────────────────────────────────────────────────
  async function runScan() {
    const vin = vinInput.value.trim().toUpperCase();
    const error = validateVin(vin);

    vinError.classList.toggle('hidden', !error);
    if (error) {
      vinError.textContent = error;
      return;
    }

    if (isScanning) return;
    isScanning = true;
    scanBtn.disabled = true;
    scanBtn.querySelector('span').textContent = 'Scanning...';
    scanBtn.querySelector('i').className = 'fas fa-circle-notch spinning';

    // Show pipeline log
    pipelinePanel.classList.remove('hidden');
    resultsGrid.classList.add('hidden');
    clearLog();
    pipelineTime.textContent = '';

    addLog('paper-plane', `Directive: Scan VIN <strong>${vin}</strong> for <strong>${selectedPersonality}</strong> buyer`, 'info');
    const spinner = addSpinner('Running pipeline...');

    const startTime = Date.now();

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, personality: selectedPersonality }),
      });

      const brief = await res.json();

      if (!res.ok) {
        throw new Error(brief.error || 'Scan failed');
      }

      removeSpinner();
      const elapsed = Date.now() - startTime;
      pipelineTime.textContent = `${(elapsed / 1000).toFixed(1)}s`;

      // Log agent results
      if (brief.vehicle) {
        addLog('check-circle', `VinDecoder: <strong>${brief.vehicle.year} ${brief.vehicle.make} ${brief.vehicle.model}</strong> (${brief.vehicle.confidence}%)`, 'success');
      }
      if (brief.buyerProfile) {
        addLog('check-circle', `PersonalityClassifier: <strong>${brief.buyerProfile.primaryType}</strong> (${brief.buyerProfile.confidence}%)`, 'success');
      }
      if (brief.salespersonMatch) {
        addLog('check-circle', `SalesMatchmaker: <strong>${brief.salespersonMatch.salesperson}</strong> (score: ${brief.salespersonMatch.score})`, 'success');
      }
      if (brief.pitch) {
        addLog('check-circle', `SalesPitchAgent: Pitch generated`, 'success');
      }
      if (brief.metadata?.errors?.length) {
        brief.metadata.errors.forEach((e) => addLog('exclamation-triangle', e, 'error'));
      }

      addLog('flag-checkered', `Complete in <strong>${(elapsed / 1000).toFixed(1)}s</strong> — ${brief.metadata?.agentsRun?.length || 0} agents`, 'info');

      // Render results
      resultsGrid.classList.remove('hidden');

      if (brief.vehicle) renderVehicle(brief.vehicle);
      if (brief.buyerProfile) renderProfile(brief.buyerProfile);
      if (brief.salespersonMatch) renderMatch(brief.salespersonMatch);
      if (brief.pitch) {
        $('#pitch-panel').classList.remove('hidden');
        renderPitch(brief.pitch);
      } else {
        $('#pitch-panel').classList.add('hidden');
      }
    } catch (err) {
      removeSpinner();
      addLog('times-circle', `Error: ${err.message}`, 'error');
    } finally {
      isScanning = false;
      scanBtn.disabled = false;
      scanBtn.querySelector('span').textContent = 'Generate Sales Brief';
      scanBtn.querySelector('i').className = 'fas fa-rocket';
    }
  }

  // ── Decode Only ───────────────────────────────────────────────────
  async function runDecode() {
    const vin = vinInput.value.trim().toUpperCase();
    const error = validateVin(vin);

    vinError.classList.toggle('hidden', !error);
    if (error) {
      vinError.textContent = error;
      return;
    }

    pipelinePanel.classList.remove('hidden');
    resultsGrid.classList.add('hidden');
    clearLog();

    addLog('search', `Decoding VIN <strong>${vin}</strong>...`, 'info');
    const spinner = addSpinner('Calling NHTSA API...');

    try {
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin }),
      });

      const vehicle = await res.json();
      removeSpinner();

      if (!res.ok) throw new Error(vehicle.error || 'Decode failed');

      addLog('check-circle', `Decoded: <strong>${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}</strong>`, 'success');

      resultsGrid.classList.remove('hidden');
      renderVehicle(vehicle);

      // Hide other panels
      $('#profile-panel').style.display = 'none';
      $('#match-panel').style.display = 'none';
      $('#pitch-panel').style.display = 'none';
    } catch (err) {
      removeSpinner();
      addLog('times-circle', `Error: ${err.message}`, 'error');
    }
  }

  // ── Roster Management ─────────────────────────────────────────────
  async function loadRoster() {
    try {
      const res = await fetch('/api/roster');
      if (!res.ok) throw new Error('Bad roster fetch');
      const roster = await res.json();
      renderRoster(roster || []);

    } catch (err) {
      console.error('Failed to load roster:', err);
    }
  }

  function renderRoster(roster) {
    const grid = $('#roster-grid');
    grid.innerHTML = roster
      .map(
        (rep) => `
      <div class="roster-card" data-id="${rep.id}">
        <div class="roster-card-header">
          <span class="roster-card-name">${rep.name}</span>
          <div class="roster-card-actions">
            <button class="btn-icon edit-rep-btn" data-id="${rep.id}" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="btn-icon delete-rep-btn" data-id="${rep.id}" title="Remove"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="roster-card-stats">
          <div class="roster-stat">
            <span class="roster-stat-label">Close Rate</span>
            <span class="roster-stat-value">${rep.closeRate}%</span>
          </div>
          <div class="roster-stat">
            <span class="roster-stat-label">Load</span>
            <span class="roster-stat-value">${rep.currentLoad}</span>
          </div>
          <div class="roster-stat">
            <span class="roster-stat-label">Status</span>
            <span class="roster-stat-value ${rep.available ? 'roster-available' : 'roster-unavailable'}">
              ${rep.available ? 'Available' : 'Busy'}
            </span>
          </div>
        </div>
        <div class="roster-tags">
          ${rep.strengths.map((s) => `<span class="roster-tag">${s}</span>`).join('')}
          ${rep.specialties.map((s) => `<span class="roster-tag specialty">${s}</span>`).join('')}
        </div>
      </div>
    `
      )
      .join('');

    // Bind delete buttons
    $$('.delete-rep-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Remove this salesperson?')) {
          await fetch(`/api/roster/${id}`, { method: 'DELETE' });
          loadRoster();
        }
      });
    });

    // Bind edit buttons
    $$('.edit-rep-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        editingRepId = btn.dataset.id;
        const res = await fetch('/api/roster');
        const roster = await res.json();
        const rep = roster.find((r) => r.id === editingRepId);
        if (!rep) return;

        $('#modal-title').textContent = 'Edit Salesperson';
        $('#rep-name').value = rep.name;
        $('#rep-strengths').value = rep.strengths.join(', ');
        $('#rep-specialties').value = rep.specialties.join(', ');
        $('#rep-close-rate').value = rep.closeRate;
        $('#rep-load').value = rep.currentLoad;
        $('#rep-modal').classList.remove('hidden');
      });
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────
  function openAddModal() {
    editingRepId = null;
    $('#modal-title').textContent = 'Add Salesperson';
    $('#rep-name').value = '';
    $('#rep-strengths').value = '';
    $('#rep-specialties').value = '';
    $('#rep-close-rate').value = '';
    $('#rep-load').value = '';
    $('#rep-modal').classList.remove('hidden');
  }

  function closeModal() {
    $('#rep-modal').classList.add('hidden');
    editingRepId = null;
  }

  async function saveRep() {
    const name = $('#rep-name').value.trim();
    const strengths = $('#rep-strengths').value.split(',').map((s) => s.trim()).filter(Boolean);
    const specialties = $('#rep-specialties').value.split(',').map((s) => s.trim()).filter(Boolean);
    const closeRate = parseInt($('#rep-close-rate').value, 10) || 50;
    const currentLoad = parseInt($('#rep-load').value, 10) || 0;

    if (!name) return alert('Name is required');

    const body = { name, strengths, specialties, closeRate, currentLoad, available: true };

    if (editingRepId) {
      await fetch(`/api/roster/${editingRepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    closeModal();
    loadRoster();
  }

  // ── History Management ────────────────────────────────────────────
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      const history = await res.json();
      renderHistory(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function renderHistory(historyList) {
    const grid = $('#history-grid');
    if (!historyList.length) {
      grid.innerHTML = '<div class="log-text" style="padding: 16px;">No recent scans found.</div>';
      return;
    }

    grid.innerHTML = historyList.map(item => {
      const date = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const vehicle = item.vehicle ? `${item.vehicle.year} ${item.vehicle.make} ${item.vehicle.model}` : 'Unknown Vehicle';
      const vin = item.vehicle?.vin || '';
      const match = item.salespersonMatch?.salesperson || 'No Match';
      const profile = item.buyerProfile?.primaryType || '';

      return `
        <div class="history-card" data-id="${item.id}">
          <div class="history-main">
            <span class="history-title">${vehicle}</span>
            <span class="history-sub">${vin} • ${profile} Buyer</span>
          </div>
          <div class="history-meta">
            <span class="history-sub">${date}</span>
            <span class="history-match">${match}</span>
          </div>
        </div>
      `;
    }).join('');

    $$('.history-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const scan = historyList.find(s => s.id === id);
        if (scan) {
          showHistoryScan(scan);
        }
      });
    });
  }

  function showHistoryScan(brief) {
    pipelinePanel.classList.add('hidden');
    resultsGrid.classList.remove('hidden');
    
    if (brief.vehicle) renderVehicle(brief.vehicle);
    if (brief.buyerProfile) renderProfile(brief.buyerProfile);
    if (brief.salespersonMatch) renderMatch(brief.salespersonMatch);
    if (brief.pitch) {
      $('#pitch-panel').classList.remove('hidden');
      renderPitch(brief.pitch);
    } else {
      $('#pitch-panel').classList.add('hidden');
    }
    
    // Scroll to results
    resultsGrid.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Event Listeners ───────────────────────────────────────────────
  scanBtn.addEventListener('click', runScan);
  decodeBtn.addEventListener('click', runDecode);
  $('#add-rep-btn').addEventListener('click', openAddModal);
  $('#refresh-history-btn').addEventListener('click', loadHistory);
  $('#modal-close').addEventListener('click', closeModal);
  $('.modal-backdrop').addEventListener('click', closeModal);
  $('#save-rep-btn').addEventListener('click', saveRep);

  // Enter key triggers scan
  vinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runScan();
  });

  // Auto-format VIN input
  vinInput.addEventListener('input', () => {
    vinInput.value = vinInput.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    vinError.classList.add('hidden');

    // Show panels when returning to scanner
    $$('#profile-panel, #match-panel, #pitch-panel').forEach((el) => {
      el.style.display = '';
    });
  });

  // ── Init ──────────────────────────────────────────────────────────
  checkHealth();
  loadRoster();
  loadHistory();
  setInterval(checkHealth, 30000);
})();
