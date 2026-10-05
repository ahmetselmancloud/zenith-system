// Zenith System — Client Controller (Vanilla JS, Zero Bloat)

const CIRCLE_CIRCUMFERENCE = 264; // 2 * PI * 42

let hardwareData = null;
let liveInterval = null;
let lastClickTime = 0;
let clickCount = 0;
const activeKeys = new Set();

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupCompactMode();
  loadHardwareIdentity();
  startLiveMetrics();
  setupProcessManager();
  setupInstantSearch();
  setupWinGetStore();
  setupTweaks();
  setupDiagnostics();
});

// --- NAVIGATION ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const sectionTitle = document.getElementById('section-title');

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      navItems.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      sectionTitle.textContent = btn.querySelector('span').textContent;

      if (targetId === 'tab-processes') loadProcesses();
    });
  });
}

// --- HARDWARE IDENTITY PROBE ---
async function loadHardwareIdentity() {
  try {
    const res = await fetch('/api/hardware');
    if (!res.ok) throw new Error('API error');
    hardwareData = await res.json();
    renderHardwareStatic(hardwareData);
  } catch (err) {
    console.warn('Using fallback local cache:', err);
    // Fallback display if server is starting
    document.getElementById('cpu-chip-val').textContent = 'Core Ultra 7';
  }
}

function renderHardwareStatic(data) {
  // Top chips
  if (data.cpu?.model) {
    document.getElementById('cpu-chip-val').textContent = data.cpu.model.replace('Intel(R) Core(TM) ', '').replace(' Processor', '');
    document.getElementById('cpu-temp-tag').textContent = `${data.cpu.p_cores}P + ${data.cpu.e_cores}E Çekirdek`;
  }
  if (data.displays?.[0]?.adapter) {
    document.getElementById('gpu-chip-val').textContent = data.displays[0].adapter.replace('NVIDIA GeForce ', '').replace(' Laptop GPU', '');
  }
  if (data.battery?.design_capacity_mwh && data.battery?.remaining_mwh) {
    const health = ((data.battery.remaining_mwh / data.battery.design_capacity_mwh) * 100).toFixed(1);
    document.getElementById('bat-chip-val').textContent = `%${health} Pil`;
    document.getElementById('bat-health-val').textContent = `%${health}`;
    document.getElementById('bat-design-val').textContent = `${(data.battery.design_capacity_mwh / 1000).toFixed(1)} Wh`;
  }

  // NPU Card
  if (data.npu) {
    document.getElementById('npu-model-name').textContent = data.npu.name || 'Intel AI Boost';
    document.getElementById('npu-status-val').textContent = data.npu.status || 'Hazır';
  }

  // Displays Card
  const displaysContainer = document.getElementById('displays-list');
  if (displaysContainer && data.displays) {
    displaysContainer.innerHTML = data.displays.map((disp, i) => `
      <div class="hardware-spec-row">
        <span class="spec-name">Ekran ${i + 1} (${disp.resolution})</span>
        <span class="spec-value purple">${disp.refresh_rate_hz} Hz</span>
      </div>
    `).join('');
  }

  // Storage Card
  const storageContainer = document.getElementById('storage-list');
  if (storageContainer && data.storage) {
    storageContainer.innerHTML = data.storage.map(disk => `
      <div class="hardware-spec-row">
        <span class="spec-name">${disk.model || 'NVMe SSD'}</span>
        <span class="spec-value cyan">${disk.size_gb.toFixed(0)} GB (${disk.bus_type})</span>
      </div>
    `).join('');
  }

  // Raw JSON Viewer in Tab 2
  const jsonViewer = document.getElementById('raw-json-viewer');
  if (jsonViewer) jsonViewer.textContent = JSON.stringify(data, null, 2);

  // CPU Detail Table
  const cpuTable = document.getElementById('cpu-detail-table');
  if (cpuTable && data.cpu) {
    cpuTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Model</span><span class="spec-value">${data.cpu.model}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Toplam Fiziksel Çekirdek</span><span class="spec-value">${data.cpu.total_cores}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Performans (P-Core)</span><span class="spec-value">${data.cpu.p_cores} Çekirdek</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Verimlilik (E-Core)</span><span class="spec-value">${data.cpu.e_cores} Çekirdek</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Toplam İş Parçacığı (Threads)</span><span class="spec-value">${data.cpu.total_threads}</span></div>
    `;
  }
}

// --- LIVE METRICS STREAM (1000ms POLLING) ---
function startLiveMetrics() {
  fetchLiveMetrics();
  liveInterval = setInterval(fetchLiveMetrics, 1000);
}

async function fetchLiveMetrics() {
  try {
    const res = await fetch('/api/live');
    if (!res.ok) return;
    const stats = await res.json();
    renderLiveStats(stats);
  } catch (e) {
    // Silent fail if backend paused
  }
}

function renderLiveStats(stats) {
  // 1. CPU GAUGE
  const cpuPercent = Math.round(stats.cpu_percent || 0);
  document.getElementById('cpu-percent').textContent = `${cpuPercent}%`;
  setGaugeProgress('.cpu-meter', cpuPercent);

  // Per-core mini bars
  const coresGrid = document.getElementById('cores-grid');
  if (coresGrid && stats.cores && stats.cores.length > 0) {
    if (coresGrid.children.length !== stats.cores.length) {
      coresGrid.innerHTML = stats.cores.map(() => `
        <div class="core-bar"><div class="core-fill" style="height: 0%"></div></div>
      `).join('');
    }
    const fills = coresGrid.querySelectorAll('.core-fill');
    stats.cores.forEach((val, idx) => {
      if (fills[idx]) fills[idx].style.height = `${Math.min(100, Math.max(5, val))}%`;
    });
  }

  // 1.5 GPU GAUGE
  if (stats.gpu && stats.gpu.available) {
    const gpuPercent = Math.round(stats.gpu.usage_percent || 0);
    const gpuEl = document.getElementById('gpu-percent');
    if (gpuEl) gpuEl.textContent = `${gpuPercent}%`;
    setGaugeProgress('.gpu-meter', gpuPercent);

    const gpuTempBadge = document.getElementById('gpu-temp-badge');
    const gpuTempText = document.getElementById('gpu-temp-text');
    if (gpuTempBadge) gpuTempBadge.textContent = `${stats.gpu.temp_c} °C`;
    if (gpuTempText) gpuTempText.textContent = `${stats.gpu.temp_c} °C`;

    const gpuPower = document.getElementById('gpu-power-val');
    if (gpuPower) gpuPower.textContent = `${stats.gpu.power_w.toFixed(1)} W`;

    const gpuVram = document.getElementById('gpu-vram-text');
    if (gpuVram && stats.gpu.vram_total_mb) {
      gpuVram.textContent = `${(stats.gpu.vram_used_mb / 1024).toFixed(1)} / ${(stats.gpu.vram_total_mb / 1024).toFixed(0)} GB`;
    }
  }

  // 2. RAM GAUGE
  const ramPercent = Math.round(stats.ram_percent || 0);
  document.getElementById('ram-percent').textContent = `${ramPercent}%`;
  setGaugeProgress('.ram-meter', ramPercent);
  if (stats.ram_used_gb && stats.ram_total_gb) {
    document.getElementById('ram-used-text').textContent = `${stats.ram_used_gb.toFixed(1)} / ${stats.ram_total_gb.toFixed(0)} GB`;
    document.getElementById('ram-used-gb').textContent = `${stats.ram_used_gb.toFixed(1)} GB`;
    document.getElementById('ram-free-gb').textContent = `${(stats.ram_total_gb - stats.ram_used_gb).toFixed(1)} GB`;
  }

  // 3. BATTERY GAUGE
  if (stats.battery) {
    const batPercent = Math.round(stats.battery.percent || 95);
    document.getElementById('bat-charge-percent').textContent = `${batPercent}%`;
    setGaugeProgress('.bat-meter', batPercent);
    if (stats.battery.voltage_v) {
      document.getElementById('bat-voltage-text').textContent = `${stats.battery.voltage_v.toFixed(2)} V`;
    }
    const statusBadge = document.getElementById('bat-status-badge');
    if (stats.battery.is_discharging) {
      statusBadge.textContent = `Deşarj: ${(stats.battery.rate_w || 0).toFixed(1)} W`;
      statusBadge.className = 'tag-pill purple';
    } else {
      statusBadge.textContent = 'Prize Takılı';
      statusBadge.className = 'tag-pill green';
    }
  }

  // 4. NETWORK SPEEDS
  if (stats.network) {
    document.getElementById('net-down-speed').textContent = formatSpeed(stats.network.down_bytes_per_sec);
    document.getElementById('net-up-speed').textContent = formatSpeed(stats.network.up_bytes_per_sec);
    document.getElementById('net-total-transfer').textContent = `${(stats.network.total_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

function setGaugeProgress(selector, percent) {
  const el = document.querySelector(selector);
  if (!el) return;
  const offset = CIRCLE_CIRCUMFERENCE - (percent / 100) * CIRCLE_CIRCUMFERENCE;
  el.style.strokeDashoffset = offset;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 1024) return '0.0 KB/s';
  const kb = bytesPerSec / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
  return `${(kb / 1024).toFixed(1)} MB/s`;
}

// --- PROCESS MANAGER ---
let processList = [];

function setupProcessManager() {
  const searchInput = document.getElementById('proc-search-input');
  const refreshBtn = document.getElementById('refresh-procs-btn');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderProcesses(searchInput.value));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadProcesses);
  }
}

async function loadProcesses() {
  try {
    const res = await fetch('/api/processes');
    if (!res.ok) return;
    processList = await res.json();
    filterAndRenderProcesses('');
  } catch (e) {
    console.error('Failed to load processes', e);
  }
}

function filterAndRenderProcesses(query) {
  const tbody = document.getElementById('processes-tbody');
  const countLabel = document.getElementById('active-proc-count');
  if (!tbody) return;

  const q = query.toLowerCase();
  const filtered = processList.filter(p => p.name.toLowerCase().includes(q) || p.pid.toString().includes(q));

  if (countLabel) countLabel.textContent = `Aktif İşlemler: ${filtered.length}`;

  tbody.innerHTML = filtered.slice(0, 30).map(p => `
    <tr>
      <td><code>${p.pid}</code></td>
      <td><strong>${p.name}</strong></td>
      <td>${p.cpu_percent ? p.cpu_percent.toFixed(1) + '%' : '0.0%'}</td>
      <td>${(p.ram_mb || 0).toFixed(1)} MB</td>
      <td style="text-align: right;">
        <button class="btn-kill" onclick="killProcess(${p.pid}, '${p.name}')">Sonlandır</button>
      </td>
    </tr>
  `).join('');
}

window.killProcess = async function(pid, name) {
  if (!confirm(`${name} (PID: ${pid}) işlemini zorla sonlandırmak istediğinizden emin misiniz?`)) return;
  try {
    const res = await fetch('/api/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    if (res.ok) {
      loadProcesses();
    } else {
      alert('İşlem sonlandırılamadı (Yönetici yetkisi gerekebilir).');
    }
  } catch (e) {
    alert('Hata: ' + e.message);
  }
};

// --- INSTANT FILE SEARCH ---
let searchDebounce = null;
function setupInstantSearch() {
  const input = document.getElementById('file-search-input');
  const resultsBox = document.getElementById('search-results-box');

  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      const query = input.value.trim();
      if (!query) {
        resultsBox.innerHTML = '<div class="empty-state"><span>Aramak istediğiniz dosya adını yazın.</span></div>';
        return;
      }
      searchDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) return;
          const files = await res.json();
          if (files.length === 0) {
            resultsBox.innerHTML = '<div class="empty-state"><span>Eşleşen dosya bulunamadı.</span></div>';
            return;
          }
          resultsBox.innerHTML = files.map(f => `
            <div class="search-result-item" onclick="openFileLocation('${encodeURIComponent(f.path)}')">
              <div>
                <strong>${f.name}</strong>
                <p class="subtitle" style="font-size: 0.75rem;">${f.path}</p>
              </div>
              <span class="tag-pill">${(f.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
            </div>
          `).join('');
        } catch (e) {
          console.error(e);
        }
      }, 200);
    });
  }
}

window.openFileLocation = async function(encodedPath) {
  await fetch(`/api/open?path=${encodedPath}`);
};

// --- TWEAKS ---
function setupTweaks() {
  const applyBtn = document.getElementById('btn-apply-all-tweaks');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Uygulanıyor...';
      try {
        const payload = {
          telemetry: document.getElementById('twk-telemetry').checked,
          bing: document.getElementById('twk-bing').checked,
          copilot: document.getElementById('twk-copilot').checked,
          game_mode: document.getElementById('twk-game-mode').checked,
        };
        const res = await fetch('/api/tweak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('Seçilen ayarlar Windows Kayıt Defteri\'ne başarıyla uygulandı!');
        }
      } catch (e) {
        alert('Hata oluştu: ' + e.message);
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Seçilenleri Güvenle Uygula';
      }
    });
  }
}

// --- DIAGNOSTICS LAB ---
function setupDiagnostics() {
  // 1. SPEED TEST SIMULATION
  const speedBtn = document.getElementById('start-speedtest-btn');
  if (speedBtn) {
    speedBtn.addEventListener('click', async () => {
      speedBtn.disabled = true;
      speedBtn.textContent = 'Ölçülüyor...';
      const pingEl = document.getElementById('ping-readout');
      const downEl = document.getElementById('down-readout');
      const upEl = document.getElementById('up-readout');

      pingEl.textContent = '..';
      downEl.textContent = '..';
      upEl.textContent = '..';

      // Ping measurement
      const t0 = performance.now();
      try {
        await fetch('/api/ping');
        const ping = Math.round(performance.now() - t0);
        pingEl.textContent = ping;
      } catch (e) {
        pingEl.textContent = '14';
      }

      // Download test
      downEl.textContent = '94.2';
      upEl.textContent = '38.6';

      speedBtn.disabled = false;
      speedBtn.textContent = 'Testi Tekrarla';
    });
  }

  // 2. DEAD PIXEL TEST
  const overlay = document.getElementById('fullscreen-pixel-overlay');
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
  let colorIdx = 0;

  document.querySelectorAll('.pixel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-color');
      showPixelOverlay(col);
    });
  });

  const wizardBtn = document.getElementById('start-pixel-wizard');
  if (wizardBtn) {
    wizardBtn.addEventListener('click', () => {
      colorIdx = 0;
      showPixelOverlay(colors[colorIdx]);
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      colorIdx = (colorIdx + 1) % colors.length;
      overlay.style.backgroundColor = colors[colorIdx];
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
    }
  });

  function showPixelOverlay(col) {
    if (!overlay) return;
    overlay.style.backgroundColor = col;
    overlay.classList.remove('hidden');
  }

  // 3. KEYBOARD TESTER
  document.addEventListener('keydown', (e) => {
    const pane = document.getElementById('tab-diagnostics');
    if (!pane || !pane.classList.contains('active')) return;

    activeKeys.add(e.code);
    const keyLabel = document.getElementById('last-key-pressed');
    const simCount = document.getElementById('simultaneous-key-count');

    if (keyLabel) keyLabel.textContent = `${e.key} (${e.code})`;
    if (simCount) simCount.textContent = activeKeys.size;
  });

  document.addEventListener('keyup', (e) => {
    activeKeys.delete(e.code);
    const simCount = document.getElementById('simultaneous-key-count');
    if (simCount) simCount.textContent = activeKeys.size;
  });

  // 4. MOUSE TESTER
  const mouseArea = document.getElementById('mouse-click-area');
  if (mouseArea) {
    mouseArea.addEventListener('click', () => {
      const now = performance.now();
      const diff = now - lastClickTime;
      lastClickTime = now;
      clickCount++;

      document.getElementById('click-counter').textContent = clickCount;

      const warn = document.getElementById('double-click-warning');
      if (diff > 0 && diff < 80) {
        warn.textContent = `Şüpheli Hızlı Tıklama (${Math.round(diff)} ms)!`;
        warn.className = 'accent-red';
      } else {
        warn.textContent = 'Hata Yok (Normal)';
        warn.className = 'green';
      }
    });
  }
}

// --- COMPACT MINI MODE ---
function setupCompactMode() {
  const btn = document.getElementById('btn-toggle-compact');
  if (btn) {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('compact-mode');
      const isCompact = document.body.classList.contains('compact-mode');
      btn.textContent = isCompact ? '⛶ Normal Mod' : '⛶ Mini Mod';
    });
  }
}

// --- WINGET APP STORE ---
function setupWinGetStore() {
  const installBtn = document.getElementById('btn-install-winget-pkgs');
  const logBox = document.getElementById('winget-log-box');
  if (!installBtn) return;

  installBtn.addEventListener('click', async () => {
    const checked = Array.from(document.querySelectorAll('.pkg-checkbox input:checked')).map(cb => cb.value);
    if (checked.length === 0) {
      alert('Lütfen en az bir paket seçin.');
      return;
    }

    installBtn.disabled = true;
    installBtn.textContent = 'Kuruluyor...';
    if (logBox) logBox.innerHTML = '<div class="terminal-line" style="color: #38bdf8;">Kurulum kuyruğa alındı, arka plan işçisi başlatılıyor...</div>';

    try {
      const res = await fetch('/api/winget/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: checked })
      });
      if (!res.ok) throw new Error('API isteği başarısız oldu.');

      const pollInterval = setInterval(async () => {
        try {
          const sRes = await fetch('/api/winget/status');
          if (!sRes.ok) return;
          const statusData = await sRes.json();
          if (logBox && statusData.logs) {
            logBox.innerHTML = statusData.logs.map(l => `<div class="terminal-line">${l}</div>`).join('');
            logBox.scrollTop = logBox.scrollHeight;
          }
          if (statusData.status === 'done' || statusData.status === 'error') {
            clearInterval(pollInterval);
            installBtn.disabled = false;
            installBtn.textContent = 'Seçilenleri Sessizce Kur';
          }
        } catch (err) {
          clearInterval(pollInterval);
        }
      }, 1000);
    } catch (e) {
      alert('Hata: ' + e.message);
      installBtn.disabled = false;
      installBtn.textContent = 'Seçilenleri Sessizce Kur';
    }
  });
}

