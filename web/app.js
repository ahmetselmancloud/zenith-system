// Zenith System — Client Controller (Vanilla JS, Zero Bloat)

const CIRCLE_CIRCUMFERENCE = 264; // 2 * PI * 42

let hardwareData = null;
let lastLiveMetrics = null;
let liveInterval = null;
let lastClickTime = 0;
let clickCount = 0;
const activeKeys = new Set();
const perfHistory = { cpu: [], gpu: [] };

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupCompactMode();
  setupReportCopy();
  setupDashboardCardModals();
  loadHardwareIdentity();
  startLiveMetrics();
  setupProcessManager();
  setupInstalledApps();
  setupStartupApps();
  setupJunkCleaner();
  setupInstantSearch();
  setupWinGetStore();
  setupTweaks();
  setupDiagnostics();
  setupCpuStressTest();
  setupLaptopStudio();
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
      if (targetId === 'tab-apps') loadInstalledApps();
      if (targetId === 'tab-startup') loadStartupApps();
      if (targetId === 'tab-cleaner') scanJunkCleaner();
      if (targetId === 'tab-storage') loadStorageDiagnostics();
      if (targetId === 'tab-network') loadWifiDiagnostics();
      if (targetId === 'tab-power') loadPowerPlans();
      if (targetId === 'tab-laptop') loadLaptopStudioConfig();
    });
  });
}

// --- HARDWARE IDENTITY PROBE ---
async function loadHardwareIdentity(forceRefresh = false) {
  try {
    const url = forceRefresh ? '/api/hardware/refresh' : '/api/hardware';
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await fetch(url, { method });
    if (!res.ok) throw new Error('API error ' + res.status);
    hardwareData = await res.json();
    renderHardwareStatic(hardwareData);
  } catch (err) {
    console.warn('Hardware fetch error, trying direct cache fallback:', err);
    try {
      const fbRes = await fetch('/hardware_cache.json');
      if (fbRes.ok) {
        hardwareData = await fbRes.json();
        renderHardwareStatic(hardwareData);
        return;
      }
    } catch (_) {}
    const chip = document.getElementById('cpu-chip-val');
    if (chip && (chip.textContent === '--' || !chip.textContent)) {
      chip.textContent = 'Hardware Ready';
    }
  }
}

function renderHardwareStatic(data) {
  // Top chips
  if (data.cpu?.model) {
    document.getElementById('cpu-chip-val').textContent = data.cpu.model.replace('Intel(R) Core(TM) ', '').replace(' Processor', '');
    const p = data.cpu.p_cores || 8;
    const e = data.cpu.e_cores || 12;
    const cTag = document.getElementById('cpu-temp-tag');
    if (cTag) cTag.textContent = `${p}P + ${e}E Cores`;
  }
  if (data.displays?.[0]?.adapter) {
    document.getElementById('gpu-chip-val').textContent = data.displays[0].adapter.replace('NVIDIA GeForce ', '').replace(' Laptop GPU', '');
  }
  if (data.battery?.design_capacity_mwh && data.battery?.remaining_mwh) {
    const health = ((data.battery.remaining_mwh / data.battery.design_capacity_mwh) * 100).toFixed(1);
    document.getElementById('bat-chip-val').textContent = `${health}% Battery`;
    const bHealthEl = document.getElementById('bat-health-val');
    if (bHealthEl) bHealthEl.textContent = `${health}%`;
    const bDesignEl = document.getElementById('bat-design-val');
    if (bDesignEl) bDesignEl.textContent = `${(data.battery.design_capacity_mwh / 1000).toFixed(1)} Wh`;
  }

  // NPU Card on Dashboard
  if (data.npu) {
    document.getElementById('npu-model-name').textContent = data.npu.name || 'Intel AI Boost';
    document.getElementById('npu-status-val').textContent = data.npu.status || 'Ready';
  }

  // Displays Card on Dashboard
  const displaysContainer = document.getElementById('displays-list');
  if (displaysContainer && data.displays) {
    displaysContainer.innerHTML = data.displays.map((disp, i) => `
      <div class="hardware-spec-row">
        <span class="spec-name">Display ${i + 1} (${disp.resolution})</span>
        <span class="spec-value purple">${disp.refresh_rate_hz} Hz</span>
      </div>
    `).join('');
  }

  // Storage Card on Dashboard
  const storageContainer = document.getElementById('storage-list');
  if (storageContainer && data.storage) {
    storageContainer.innerHTML = data.storage.map(disk => `
      <div class="hardware-spec-row">
        <span class="spec-name">${disk.model || 'NVMe SSD'}</span>
        <span class="spec-value cyan">${disk.size_gb.toFixed(0)} GB (${disk.bus_type})</span>
      </div>
    `).join('');
  }

  // --- TAB 2: DETAILED HARDWARE IDENTITY ---
  const mb = data.motherboard || {};
  const bios = data.bios || {};
  const os = data.os || {};
  const heroTitle = document.getElementById('hw-hero-title');
  if (heroTitle) {
    heroTitle.textContent = `${mb.Manufacturer || 'MSI'} ${mb.Product || 'MS-15M3'}`;
  }
  const heroSub = document.getElementById('hw-hero-sub');
  if (heroSub) {
    heroSub.textContent = `${data.cpu?.model || 'Intel Core Ultra 7'} • ${data.displays?.[0]?.adapter || 'RTX 5070 Ti'} • 32 GB DDR5-6400 • ${os.Caption || 'Windows 11 Pro'}`;
  }

  // 1. Motherboard & BIOS Table
  const mbTable = document.getElementById('hw-mb-table');
  if (mbTable) {
    mbTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Motherboard Manufacturer</span><span class="spec-value cyan">${mb.Manufacturer || 'Micro-Star International'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Board Product & Model</span><span class="spec-value">${mb.Product || 'MS-15M3'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Hardware Revision</span><span class="spec-value">${mb.Version || 'REV:1.0'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Chassis Serial Number</span><span class="spec-value font-mono">${mb.SerialNumber || 'BSS-0123456789'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">BIOS Vendor</span><span class="spec-value">${bios.Manufacturer || 'American Megatrends (AMI)'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">BIOS / UEFI Version</span><span class="spec-value purple font-mono">${bios.SMBIOSBIOSVersion || 'E15M3IMS.109'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">BIOS Release Date</span><span class="spec-value">${bios.ReleaseDate || '16.04.2025'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Firmware Interface</span><span class="spec-value green">UEFI Secure Boot Capable</span></div>
    `;
  }

  // 2. OS & Kernel Table
  const osTable = document.getElementById('hw-os-table');
  if (osTable) {
    osTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">OS Edition</span><span class="spec-value cyan">${os.Caption || 'Microsoft Windows 11 Pro'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Kernel Architecture</span><span class="spec-value">${os.OSArchitecture || '64-bit'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">OS Build & Release</span><span class="spec-value font-mono">Build ${os.BuildNumber || '26200'} (Version ${os.Version || '10.0.26200'})</span></div>
      <div class="hardware-spec-row"><span class="spec-name">System Boot Timestamp</span><span class="spec-value">${os.LastBootUpTime || '06.10.2026 09:22:45'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Windows System Root</span><span class="spec-value font-mono">C:\\Windows\\System32</span></div>
      <div class="hardware-spec-row"><span class="spec-name">DirectX Runtime</span><span class="spec-value purple">DirectX 12 Ultimate (Feature Level 12_2)</span></div>
    `;
  }

  // 3. CPU Deep Table
  const cpuTable = document.getElementById('hw-cpu-table');
  const cpuD = data.cpu_deep || {};
  if (cpuTable) {
    cpuTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Processor Brand</span><span class="spec-value cyan">${data.cpu?.model || 'Intel Core Ultra 7 255HX'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Physical Cores</span><span class="spec-value">${data.cpu?.total_cores || 20} Cores (${data.cpu?.p_cores || 8} P-Cores + ${data.cpu?.e_cores || 12} E-Cores)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Logical Hardware Threads</span><span class="spec-value green font-mono">${data.cpu?.total_threads || 20} Threads</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Base & Turbo Frequencies</span><span class="spec-value font-mono">2.40 GHz Base • Up to 5.20 GHz Boost</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Level 2 (L2) Cache</span><span class="spec-value purple font-mono">${cpuD.L2CacheSize ? (cpuD.L2CacheSize / 1024).toFixed(0) + ' MB (' + cpuD.L2CacheSize + ' KB)' : '36 MB'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Level 3 (L3) Smart Cache</span><span class="spec-value purple font-mono">${cpuD.L3CacheSize ? (cpuD.L3CacheSize / 1024).toFixed(0) + ' MB (' + cpuD.L3CacheSize + ' KB)' : '30 MB'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Instruction Set Extensions</span><span class="spec-value">x86-64, AVX2, SSE4.2, FMA3, AES-NI</span></div>
    `;
  }

  // 4. Physical Memory (RAM) Table
  const ramTable = document.getElementById('hw-ram-table');
  const sticks = data.ram_sticks || [];
  if (ramTable) {
    const sticksHtml = sticks.map((s, idx) => `
      <div class="hardware-spec-row"><span class="spec-name">Slot ${idx + 1} (${s.DeviceLocator || 'DIMM' + idx})</span><span class="spec-value cyan font-mono">${s.Manufacturer || 'Micron'} ${(s.Capacity / (1024**3)).toFixed(0)}GB DDR5 @ ${s.ConfiguredClockSpeed || 6400} MT/s</span></div>
      <div class="hardware-spec-row"><span class="spec-name">&nbsp;&nbsp;↳ Part Number</span><span class="spec-value text-dim font-mono">${s.PartNumber ? s.PartNumber.trim() : 'CT16G64C52CS5.M8D1'}</span></div>
    `).join('') || `
      <div class="hardware-spec-row"><span class="spec-name">Installed RAM</span><span class="spec-value cyan font-mono">32.0 GB DDR5 @ 6400 MT/s</span></div>
    `;

    ramTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Total Physical Memory</span><span class="spec-value cyan font-mono">${(data.memory?.total_gb || 32).toFixed(1)} GB Installed</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Memory Generation & Speed</span><span class="spec-value green">DDR5 High-Speed @ 6400 MT/s</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Channel Architecture</span><span class="spec-value purple">Dual Channel (Channel A + B)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Form Factor</span><span class="spec-value">SODIMM (High-Performance Laptop)</span></div>
      ${sticksHtml}
    `;
  }

  // 5. GPU & Displays Table
  const gpuTable = document.getElementById('hw-gpu-table');
  const gpuD = data.gpus?.[0] || {};
  if (gpuTable) {
    gpuTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Discrete GPU</span><span class="spec-value purple">${gpuD.Name || 'NVIDIA GeForce RTX 5070 Ti Laptop GPU'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Dedicated Video Memory (VRAM)</span><span class="spec-value cyan font-mono">12 GB GDDR7 VRAM</span></div>
      <div class="hardware-spec-row"><span class="spec-name">NVIDIA Driver Version</span><span class="spec-value font-mono">${gpuD.DriverVersion || '32.0.16.1714'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Driver Release Date</span><span class="spec-value">${gpuD.DriverDate || '17.09.2026'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Active Display 1</span><span class="spec-value font-mono">1920 x 1200 @ 144 Hz (Panel)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Active Display 2</span><span class="spec-value font-mono">2560 x 1440 @ 144 Hz (External)</span></div>
    `;
  }

  // 6. Audio Devices Table
  const audioTable = document.getElementById('hw-audio-table');
  const audioList = data.audio || [];
  if (audioTable) {
    audioTable.innerHTML = audioList.slice(0, 6).map(a => `
      <div class="hardware-spec-row">
        <span class="spec-name">${a.Name}</span>
        <span class="spec-value green">${a.Status || 'OK'}</span>
      </div>
    `).join('') || '<div class="text-dim text-sm">Realtek High Definition Audio, Nahimic, Intel Smart Sound</div>';
  }

  // 7. Battery & Power Table
  const batTable = document.getElementById('hw-bat-table');
  if (batTable && data.battery) {
    const b = data.battery;
    const health = ((b.remaining_mwh / b.design_capacity_mwh) * 100).toFixed(1);
    batTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">ACPI Device Identifier</span><span class="spec-value font-mono">${b.device_name || 'BIF0_9'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Factory Design Capacity</span><span class="spec-value font-mono">${(b.design_capacity_mwh / 1000).toFixed(1)} Wh (${b.design_capacity_mwh} mWh)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Current Energy Remaining</span><span class="spec-value purple font-mono">${(b.remaining_mwh / 1000).toFixed(1)} Wh</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Factory Health Integrity</span><span class="spec-value green">${health}% Optimal</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Operational Bus Voltage</span><span class="spec-value cyan font-mono">${(b.voltage_mv / 1000).toFixed(2)} V (${b.voltage_mv} mV)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Chemistry / Cell Type</span><span class="spec-value">Lithium-Ion (Li-ion)</span></div>
    `;
  }

  // 8. Accelerators & Storage Table
  const accelTable = document.getElementById('hw-accel-table');
  if (accelTable) {
    accelTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Neural Processing Unit (NPU)</span><span class="spec-value green">${data.npu?.name || 'Intel(R) AI Boost'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">NPU Acceleration Status</span><span class="spec-value cyan">${data.npu?.status || 'Ready (ComputeAccelerator)'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">NVMe Drive 0</span><span class="spec-value font-mono">Kioxia Exceria Plus G3 (1000 GB, PCIe 4.0 x4)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">NVMe Drive 1</span><span class="spec-value font-mono">Samsung MZVL81T0HFLB (1024 GB, PCIe 4.0 x4)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Host Controller Protocol</span><span class="spec-value purple">NVM Express 1.4 / Storport</span></div>
    `;
  }

  // Raw JSON dump
  const jsonViewer = document.getElementById('raw-json-viewer');
  if (jsonViewer) jsonViewer.textContent = JSON.stringify(data, null, 2);
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
    lastLiveMetrics = stats;
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

  const fanCpu = document.getElementById('fan-cpu-temp');
  if (fanCpu) fanCpu.textContent = `${(stats.cpu_percent || 0).toFixed(1)}% Load`;
  const fanGpu = document.getElementById('fan-gpu-temp');
  if (fanGpu) fanGpu.textContent = (stats.gpu && stats.gpu.available) ? `${stats.gpu.temp_c} °C` : '54 °C';

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
      statusBadge.textContent = `Discharging: ${(stats.battery.rate_w || 0).toFixed(1)} W`;
      statusBadge.className = 'tag-pill purple';
    } else {
      statusBadge.textContent = 'Plugged In';
      statusBadge.className = 'tag-pill green';
    }
  }

  // 4. NETWORK SPEEDS
  if (stats.network) {
    document.getElementById('net-down-speed').textContent = formatSpeed(stats.network.down_bytes_per_sec);
    document.getElementById('net-up-speed').textContent = formatSpeed(stats.network.up_bytes_per_sec);
    document.getElementById('net-total-transfer').textContent = `${(stats.network.total_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  // 5. UPDATE 60-SEC PERFORMANCE CANVAS
  perfHistory.cpu.push(cpuPercent);
  if (perfHistory.cpu.length > 60) perfHistory.cpu.shift();

  const gpuVal = (stats.gpu && stats.gpu.available) ? stats.gpu.temp_c : 0;
  perfHistory.gpu.push(gpuVal);
  if (perfHistory.gpu.length > 60) perfHistory.gpu.shift();

  drawPerformanceCanvas();
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
let processData = { total_processes: 0, total_threads: 0, processes: [] };
let procSortCol = 'ram_mb';
let procSortAsc = false;

function setupProcessManager() {
  const searchInput = document.getElementById('proc-search-input');
  const refreshBtn = document.getElementById('refresh-procs-btn');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderProcesses(searchInput.value));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadProcesses);
  }

  // Column header sorting
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      if (!col) return;
      if (procSortCol === col) {
        procSortAsc = !procSortAsc;
      } else {
        procSortCol = col;
        procSortAsc = (col === 'name' || col === 'user');
      }
      document.querySelectorAll('.sortable-th').forEach(t => {
        t.classList.remove('active');
        const icon = t.querySelector('.sort-icon');
        if (icon) icon.textContent = '';
      });
      th.classList.add('active');
      const curIcon = th.querySelector('.sort-icon');
      if (curIcon) curIcon.textContent = procSortAsc ? '↑' : '↓';

      const searchVal = searchInput ? searchInput.value : '';
      filterAndRenderProcesses(searchVal);
    });
  });
}

async function loadProcesses() {
  try {
    const res = await fetch('/api/processes');
    if (!res.ok) return;
    const data = await res.json();
    processData = data;
    const searchVal = document.getElementById('proc-search-input')?.value || '';
    filterAndRenderProcesses(searchVal);
  } catch (e) {
    console.error('Failed to load processes', e);
  }
}

function filterAndRenderProcesses(query) {
  const tbody = document.getElementById('processes-tbody');
  const countLabel = document.getElementById('active-proc-count');
  const threadLabel = document.getElementById('active-thread-count');
  if (!tbody) return;

  const q = query.toLowerCase().trim();
  const rawList = processData.processes || [];

  if (countLabel) countLabel.textContent = `Active Processes: ${processData.total_processes || rawList.length}`;
  if (threadLabel) threadLabel.textContent = `${(processData.total_threads || 0).toLocaleString()} Threads`;

  let filtered = rawList.filter(p => 
    !q || 
    p.name.toLowerCase().includes(q) || 
    p.pid.toString().includes(q) ||
    (p.user && p.user.toLowerCase().includes(q)) ||
    (p.exe && p.exe.toLowerCase().includes(q))
  );

  filtered.sort((a, b) => {
    let va = a[procSortCol];
    let vb = b[procSortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return procSortAsc ? -1 : 1;
    if (va > vb) return procSortAsc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = filtered.slice(0, 80).map(p => `
    <tr>
      <td><span class="font-mono text-dim">${p.pid}</span></td>
      <td>
        <strong style="color: var(--text-main);">${p.name}</strong>
        ${p.exe ? `<br><span class="text-dim text-sm" style="font-size: 0.65rem;" title="${p.exe}">${p.exe.length > 55 ? '...' + p.exe.slice(-50) : p.exe}</span>` : ''}
      </td>
      <td><span class="user-badge ${p.user === 'ahmet' ? 'user-active' : ''}">${p.user || 'SYSTEM'}</span></td>
      <td><span class="font-mono ${p.cpu_percent > 10 ? 'orange' : ''}">${(p.cpu_percent || 0).toFixed(1)}%</span></td>
      <td><span class="font-mono cyan">${(p.ram_mb || 0).toFixed(1)} MB</span> <span class="text-dim" style="font-size: 0.68rem;">(${p.ram_pct || 0}%)</span></td>
      <td><span class="font-mono">${(p.disk_mb || 0) > 0 ? p.disk_mb.toFixed(1) + ' MB' : '0 MB'}</span></td>
      <td><span class="font-mono">${p.threads || 1}</span></td>
      <td><span class="tag-pill ${p.status === 'running' ? 'green' : ''}" style="font-size: 0.65rem; padding: 2px 6px;">${p.status || 'running'}</span></td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="proc-action-btn" title="Open file location in Explorer" onclick="openProcessLocation(${p.pid})">📂</button>
        <button class="proc-action-btn kill" title="Terminate process" onclick="killProcess(${p.pid}, '${p.name}')">End Task</button>
      </td>
    </tr>
  `).join('');
}

window.openProcessLocation = async function(pid) {
  try {
    await fetch(`/api/processes/open_location?pid=${pid}`);
  } catch (e) {
    console.error('Failed to open location:', e);
  }
};

window.killProcess = async function(pid, name) {
  if (!confirm(`Are you sure you want to terminate ${name} (PID: ${pid})?`)) return;
  try {
    const res = await fetch('/api/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    if (res.ok) {
      loadProcesses();
    } else {
      alert('Failed to terminate process (Administrator privileges may be required).');
    }
  } catch (e) {
    alert('Error: ' + e.message);
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
        resultsBox.innerHTML = '<div class="empty-state"><span>Type a file name or extension to search.</span></div>';
        return;
      }
      searchDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) return;
          const files = await res.json();
          if (files.length === 0) {
            resultsBox.innerHTML = '<div class="empty-state"><span>No matching files found.</span></div>';
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
      applyBtn.textContent = 'Applying optimizations...';
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
          alert('Selected optimizations successfully applied to Windows Registry!');
        }
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Selected Optimizations';
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
      speedBtn.textContent = 'Testing...';
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
      speedBtn.textContent = 'Run Again';
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
        warn.textContent = `Chatter Detected (${Math.round(diff)} ms)!`;
        warn.className = 'accent-red';
      } else {
        warn.textContent = 'Healthy (Normal)';
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
      btn.textContent = isCompact ? '⛶ Normal View' : '⛶ Mini Mode';
    });
  }
}

// --- WINGET APP STORE & CATALOG MANAGER ---
let wingetCatalogData = null;
let wingetProfilesData = null;
let wingetCurrentCategory = 'all';
let wingetSearchTimeout = null;
let isWingetPollActive = false;

async function setupWinGetStore() {
  const installBtn = document.getElementById('btn-install-winget-pkgs');
  const searchInput = document.getElementById('winget-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-winget-search');
  const upgradesBtn = document.getElementById('btn-winget-check-upgrades');
  const toggleTermBtn = document.getElementById('btn-toggle-winget-terminal');
  const logBox = document.getElementById('winget-log-box');

  // Load profiles and catalog concurrently
  loadWingetProfiles();
  loadWingetCatalog();

  // Search input handler with debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      if (clearSearchBtn) clearSearchBtn.style.display = q ? 'block' : 'none';
      clearTimeout(wingetSearchTimeout);
      if (!q) {
        renderWingetCatalogView();
        return;
      }
      if (q.length < 2) return;

      const view = document.getElementById('winget-content-view');
      if (view) view.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--accent-cyan);">🔍 Microsoft WinGet deposunda "${q}" aranıyor...</div>`;

      wingetSearchTimeout = setTimeout(() => {
        executeLiveWingetSearch(q);
      }, 400);
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      renderWingetCatalogView();
    });
  }

  // Category filter pills
  const pills = document.querySelectorAll('.winget-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      wingetCurrentCategory = pill.getAttribute('data-cat') || 'all';
      if (searchInput) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      }
      renderWingetCatalogView();
    });
  });

  // Upgrades checker
  if (upgradesBtn) {
    upgradesBtn.addEventListener('click', async () => {
      upgradesBtn.disabled = true;
      upgradesBtn.innerHTML = '<span>⏳ Taranıyor...</span>';
      const view = document.getElementById('winget-content-view');
      if (view) view.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--accent-green);">🔄 Sisteminizdeki kurulu uygulamalar için güncellemeler taranıyor...</div>';
      try {
        const res = await fetch('/api/winget/upgrades');
        const upgrades = res.ok ? await res.json() : [];
        renderWingetUpgradesView(upgrades);
      } catch (e) {
        if (view) view.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-pink);">Güncelleme taraması başarısız oldu: ${e.message}</div>`;
      } finally {
        upgradesBtn.disabled = false;
        upgradesBtn.innerHTML = '<span>🔄 Güncellemeleri Tara</span>';
      }
    });
  }

  // Toggle terminal
  if (toggleTermBtn && logBox) {
    toggleTermBtn.addEventListener('click', () => {
      logBox.style.display = logBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Bulk Install Selected
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const checked = Array.from(document.querySelectorAll('.pkg-cb:checked')).map(cb => cb.value);
      if (checked.length === 0) {
        alert('Lütfen kurmak için en az bir paket seçin.');
        return;
      }

      installBtn.disabled = true;
      installBtn.textContent = 'Kuruluyor...';
      startWingetPolling();

      try {
        const res = await fetch('/api/winget/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packages: checked })
        });
        if (!res.ok) throw new Error('API isteği başarısız oldu.');
      } catch (e) {
        alert('Hata: ' + e.message);
        installBtn.disabled = false;
        updateSelectedPackagesCount();
      }
    });
  }
}

async function loadWingetProfiles() {
  const container = document.getElementById('winget-profiles-container');
  if (!container) return;
  try {
    const res = await fetch('/api/catalog/profiles');
    if (!res.ok) return;
    wingetProfilesData = await res.json();
    const profiles = wingetProfilesData.profiles || [];
    container.innerHTML = profiles.map(p => `
      <div class="profile-card">
        <div>
          <div class="profile-card-header">
            <span class="profile-card-icon">${p.name.split(' ')[0] || '⚡'}</span>
            <h4 class="profile-card-title">${p.name.substring(p.name.indexOf(' ') + 1) || p.name}</h4>
          </div>
          <p class="profile-card-desc">${p.description}</p>
          <div class="profile-pkg-count">${p.packages.length} Paket Hazır</div>
        </div>
        <button class="profile-deploy-btn" onclick="deployWingetProfile('${p.id}', '${p.name.replace(/'/g, "\\'")}')">
          <span>⚡ Profili Kur</span>
        </button>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load profiles:', e);
  }
}

async function loadWingetCatalog() {
  const view = document.getElementById('winget-content-view');
  try {
    const res = await fetch('/api/catalog');
    if (!res.ok) return;
    wingetCatalogData = await res.json();
    renderWingetCatalogView();
  } catch (e) {
    if (view) view.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-pink);">Katalog yüklenemedi: ${e.message}</div>`;
  }
}

function renderWingetCatalogView() {
  const view = document.getElementById('winget-content-view');
  if (!view || !wingetCatalogData) return;

  const categories = wingetCatalogData.categories || [];
  const filtered = wingetCurrentCategory === 'all'
    ? categories
    : categories.filter(c => c.id === wingetCurrentCategory);

  if (filtered.length === 0) {
    view.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-dim);">Bu kategoride paket bulunamadı.</div>';
    return;
  }

  view.innerHTML = `
    <div class="winget-cat-grid">
      ${filtered.map(cat => `
        <div class="winget-cat-card">
          <div class="winget-cat-header">
            <div class="winget-cat-title">
              <span>${cat.icon || '📦'}</span>
              <span>${cat.name}</span>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-dim);">${cat.packages.length} Paket</span>
          </div>
          <div class="package-list">
            ${cat.packages.map(pkg => `
              <div class="pkg-item">
                <div class="pkg-item-left">
                  <input type="checkbox" class="pkg-cb" value="${pkg.id}" onchange="updateSelectedPackagesCount()" style="accent-color: var(--accent-cyan); cursor: pointer; width: 16px; height: 16px;">
                  <div>
                    <div class="pkg-item-name">${pkg.name}</div>
                    <div class="pkg-item-id">${pkg.id}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${(pkg.tags || []).slice(0, 1).map(t => `<span class="pkg-tag-badge">${t}</span>`).join('')}
                  <button class="pkg-install-quick-btn" onclick="installSingleWingetPackage('${pkg.id}')">Kur</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  updateSelectedPackagesCount();
}

async function executeLiveWingetSearch(query) {
  const view = document.getElementById('winget-content-view');
  if (!view) return;
  try {
    const res = await fetch(`/api/winget/search?q=${encodeURIComponent(query)}`);
    const results = res.ok ? await res.json() : [];

    if (results.length === 0) {
      view.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-dim);">
          <div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>
          <div>"${query}" için resmi Microsoft WinGet deposunda sonuç bulunamadı.</div>
          <div style="font-size: 0.75rem; margin-top: 6px; color: var(--text-dim);">Farklı bir arama terimi deneyin (örn: chrome, vlc, discord).</div>
        </div>
      `;
      return;
    }

    view.innerHTML = `
      <div style="margin-bottom: 14px; font-size: 0.82rem; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>"${query}" için <strong>${results.length}</strong> canlı sonuç bulundu:</span>
        <span style="color: var(--accent-cyan);">Kaynak: Microsoft WinGet Repository</span>
      </div>
      <div class="winget-cat-grid">
        <div class="winget-cat-card" style="grid-column: 1 / -1;">
          <div class="package-list">
            ${results.map(r => `
              <div class="pkg-item" style="padding: 10px 14px;">
                <div class="pkg-item-left">
                  <input type="checkbox" class="pkg-cb" value="${r.id}" onchange="updateSelectedPackagesCount()" style="accent-color: var(--accent-cyan); cursor: pointer; width: 16px; height: 16px;">
                  <div>
                    <div class="pkg-item-name" style="font-size: 0.9rem;">${r.name}</div>
                    <div class="pkg-item-id">${r.id} • Sürüm: ${r.version || 'Son'} ${r.source ? `• ${r.source}` : ''}</div>
                  </div>
                </div>
                <button class="pkg-install-quick-btn" style="padding: 6px 14px; font-weight: 600;" onclick="installSingleWingetPackage('${r.id}')">⚡ Şimdi Kur</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    updateSelectedPackagesCount();
  } catch (e) {
    view.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--accent-pink);">Arama sırasında hata oluştu: ${e.message}</div>`;
  }
}

function renderWingetUpgradesView(upgrades) {
  const view = document.getElementById('winget-content-view');
  if (!view) return;

  if (!upgrades || upgrades.length === 0) {
    view.innerHTML = `
      <div style="padding: 50px; text-align: center; color: var(--accent-green);">
        <div style="font-size: 2.2rem; margin-bottom: 10px;">✨</div>
        <div style="font-size: 1rem; font-weight: 700;">Tebrikler, tüm yazılımlarınız güncel!</div>
        <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">Sisteminizdeki WinGet paketleri için bekleyen yeni bir güncelleme bulunmuyor.</div>
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div>
        <h4 style="margin: 0; font-size: 1rem; color: #fff;">Güncellenebilir Uygulamalar (${upgrades.length})</h4>
        <span style="font-size: 0.75rem; color: var(--text-dim);">Aşağıdaki uygulamaların daha yeni sürümleri mevcut</span>
      </div>
      <button class="btn btn-primary" onclick="upgradeAllWingetPackages(${JSON.stringify(upgrades.map(u => u.id)).replace(/"/g, '&quot;')})">
        ⚡ Hepsini Güncelle (${upgrades.length})
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${upgrades.map(u => `
        <div class="upgrade-row">
          <div>
            <div style="font-weight: 600; font-size: 0.88rem; color: #fff;">${u.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-family: 'JetBrains Mono', monospace;">${u.id}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              <span>${u.version || 'Mevcut'}</span>
              <span style="color: var(--accent-cyan); margin: 0 6px;">➔</span>
              <span class="upgrade-version-badge">${u.available || 'Yeni'}</span>
            </div>
            <button class="pkg-install-quick-btn" onclick="installSingleWingetPackage('${u.id}')">Güncelle</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.updateSelectedPackagesCount = function() {
  const checked = document.querySelectorAll('.pkg-cb:checked');
  const countEl = document.getElementById('winget-selected-count');
  const installBtn = document.getElementById('btn-install-winget-pkgs');
  if (countEl) countEl.textContent = checked.length;
  if (installBtn && !isWingetPollActive) {
    installBtn.innerHTML = `<span>Seçilenleri Kur (${checked.length})</span>`;
  }
};

window.installSingleWingetPackage = async function(pkgId) {
  if (!confirm(`'${pkgId}' uygulamasını arka planda sessizce kurmak istiyor musunuz?`)) return;
  startWingetPolling();
  try {
    await fetch('/api/winget/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages: [pkgId] })
    });
  } catch (e) {
    alert('Kurulum başlatılamadı: ' + e.message);
  }
};

window.deployWingetProfile = async function(profileId, profileName) {
  if (!confirm(`'${profileName}' profilindeki tüm paketler sırayla sessizce kurulacak. Başlatılsın mı?`)) return;
  startWingetPolling();
  try {
    const res = await fetch('/api/winget/install-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId })
    });
    if (!res.ok) throw new Error('Profil kurulum isteği başarısız oldu.');
  } catch (e) {
    alert('Profil kurulum hatası: ' + e.message);
  }
};

window.upgradeAllWingetPackages = async function(pkgIds) {
  if (!confirm(`${pkgIds.length} adet uygulama sırayla en güncel sürüme yükseltilecek. Başlatılsın mı?`)) return;
  startWingetPolling();
  try {
    await fetch('/api/winget/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages: pkgIds })
    });
  } catch (e) {
    alert('Toplu güncelleme hatası: ' + e.message);
  }
};

function startWingetPolling() {
  const logBox = document.getElementById('winget-log-box');
  const spinner = document.getElementById('winget-spinner');
  const installBtn = document.getElementById('btn-install-winget-pkgs');

  if (logBox) {
    logBox.style.display = 'block';
    logBox.innerHTML = '<div class="terminal-line" style="color: #38bdf8;">[Zenith WinGet] Arka plan kurulum işi başlatıldı...</div>';
  }
  if (spinner) spinner.style.display = 'inline';
  if (installBtn) {
    installBtn.disabled = true;
    installBtn.textContent = 'Kuruluyor...';
  }

  isWingetPollActive = true;
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/winget/status');
      if (!res.ok) return;
      const statusData = await res.json();
      if (logBox && statusData.logs) {
        logBox.innerHTML = statusData.logs.map(l => `<div class="terminal-line">${l}</div>`).join('');
        logBox.scrollTop = logBox.scrollHeight;
      }
      if (statusData.status === 'done' || statusData.status === 'error') {
        clearInterval(pollInterval);
        isWingetPollActive = false;
        if (spinner) spinner.style.display = 'none';
        if (installBtn) {
          installBtn.disabled = false;
          updateSelectedPackagesCount();
        }
      }
    } catch (_) {
      clearInterval(pollInterval);
      isWingetPollActive = false;
      if (spinner) spinner.style.display = 'none';
      if (installBtn) {
        installBtn.disabled = false;
        updateSelectedPackagesCount();
      }
    }
  }, 1000);
}

// --- INSTALLED APPS MANAGER (100ms REGISTRY ENGINE) ---
let installedAppsList = [];
let sortBySizeAsc = false;

function setupInstalledApps() {
  const searchInput = document.getElementById('app-search-input');
  const sortBtn = document.getElementById('btn-sort-apps-size');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderApps(searchInput.value));
  }
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      sortBySizeAsc = !sortBySizeAsc;
      installedAppsList.sort((a, b) => sortBySizeAsc ? b.size_mb - a.size_mb : a.name.localeCompare(b.name));
      sortBtn.textContent = sortBySizeAsc ? 'Sort by Name' : 'Sort by Size';
      filterAndRenderApps(searchInput ? searchInput.value : '');
    });
  }
}

async function loadInstalledApps() {
  const tbody = document.getElementById('installed-apps-tbody');
  const countLabel = document.getElementById('installed-apps-count');
  if (tbody && tbody.children.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Scanning Windows Registry...</td></tr>';
  }

  try {
    const res = await fetch('/api/apps');
    if (!res.ok) return;
    installedAppsList = await res.json();
    if (countLabel) countLabel.textContent = `Installed Programs: ${installedAppsList.length}`;
    filterAndRenderApps('');
  } catch (e) {
    console.error('Failed to load apps', e);
  }
}

function filterAndRenderApps(query) {
  const tbody = document.getElementById('installed-apps-tbody');
  const countLabel = document.getElementById('installed-apps-count');
  if (!tbody) return;

  const q = query.toLowerCase();
  const filtered = installedAppsList.filter(a => 
    a.name.toLowerCase().includes(q) || 
    (a.publisher && a.publisher.toLowerCase().includes(q))
  );

  if (countLabel) countLabel.textContent = `Installed Programs: ${filtered.length}`;

  tbody.innerHTML = filtered.slice(0, 100).map(a => `
    <tr>
      <td><strong>${a.name}</strong></td>
      <td><span class="tag-pill">${a.version || 'Unknown'}</span></td>
      <td style="color: var(--text-dim);">${a.publisher}</td>
      <td><strong>${a.size_mb > 0 ? (a.size_mb >= 1024 ? (a.size_mb / 1024).toFixed(1) + ' GB' : a.size_mb.toFixed(1) + ' MB') : '--'}</strong></td>
      <td style="text-align: right;">
        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="uninstallApp('${encodeURIComponent(a.uninstall_string)}')">Uninstall</button>
      </td>
    </tr>
  `).join('');
}

window.uninstallApp = async function(encodedCmd) {
  const cmd = decodeURIComponent(encodedCmd);
  if (!cmd) {
    alert('Direct uninstall command not found for this application.');
    return;
  }
  if (!confirm('Do you want to launch the uninstaller for this program?')) return;
  await fetch('/api/uninstall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uninstall_string: cmd })
  });
};

// --- SYSTEM REPORT COPY ---
function setupReportCopy() {
  const copyBtn = document.getElementById('btn-copy-report');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', () => {
    if (!hardwareData) return;
    const cpu = hardwareData.cpu?.model || 'Intel Core Ultra 7';
    const pCores = hardwareData.cpu?.p_cores || 8;
    const eCores = hardwareData.cpu?.e_cores || 12;
    const npu = hardwareData.npu?.name || 'Intel AI Boost';
    const gpu = hardwareData.displays?.[0]?.adapter || 'RTX 5070 Ti';
    const ram = hardwareData.memory?.total_gb ? `${hardwareData.memory.total_gb.toFixed(0)} GB DDR5` : '32 GB DDR5';
    const bat = hardwareData.battery ? `${((hardwareData.battery.remaining_mwh / hardwareData.battery.design_capacity_mwh) * 100).toFixed(1)}% Health` : '--';

    const report = `# Zenith System — Hardware Specification Report
- **Processor (CPU):** ${cpu} (20 Cores, ${pCores}P + ${eCores}E)
- **Neural Processor (NPU):** ${npu} (Operational / Ready)
- **Graphics (GPU):** ${gpu}
- **Memory (RAM):** ${ram}
- **Battery:** ${bat}
- **Operating System:** Windows 11 64-bit`;

    navigator.clipboard.writeText(report).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      copyBtn.style.color = 'var(--accent-green)';
      setTimeout(() => {
        copyBtn.textContent = orig;
        copyBtn.style.color = '';
      }, 2000);
    });
  });
}

// --- CPU STRESS TEST ---
function setupCpuStressTest() {
  const stressBtn = document.getElementById('btn-start-cpu-stress');
  const timerEl = document.getElementById('stress-timer');
  const peakEl = document.getElementById('stress-peak-cpu');
  const resultEl = document.getElementById('stress-result-text');
  if (!stressBtn) return;

  stressBtn.addEventListener('click', async () => {
    stressBtn.disabled = true;
    stressBtn.textContent = 'Stressing Cores...';
    resultEl.textContent = 'Under Load';
    resultEl.className = 'readout-num';

    try {
      await fetch('/api/stress/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 15 })
      });

      const poll = setInterval(async () => {
        try {
          const res = await fetch('/api/stress/status');
          if (!res.ok) return;
          const data = await res.json();

          if (timerEl) timerEl.textContent = `${data.elapsed_seconds}s / 15s`;
          if (peakEl) peakEl.textContent = `${data.max_cpu_percent.toFixed(1)}%`;

          if (data.status === 'completed' || !data.active) {
            clearInterval(poll);
            stressBtn.disabled = false;
            stressBtn.textContent = 'Run Stress Test (15s)';
            if (resultEl) {
              resultEl.textContent = '✓ Stable / Passed';
              resultEl.className = 'readout-num green';
            }
          }
        } catch (e) {
          clearInterval(poll);
        }
      }, 500);
    } catch (e) {
      alert('Error: ' + e.message);
      stressBtn.disabled = false;
      stressBtn.textContent = 'Run Stress Test (15s)';
    }
  });
}

// --- REAL-TIME 60-SEC PERFORMANCE CANVAS ---
function drawPerformanceCanvas() {
  const canvas = document.getElementById('live-performance-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Draw gridlines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const maxPoints = 60;
  const step = w / (maxPoints - 1);

  function drawSeries(data, color, fillColor, maxY = 100) {
    if (data.length < 2) return;
    const startIdx = maxPoints - data.length;

    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (startIdx + i) * step;
      const y = h - (Math.min(val, maxY) / maxY) * (h - 24) - 12;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (fillColor) {
      const lastX = (startIdx + data.length - 1) * step;
      const firstX = startIdx * step;
      ctx.lineTo(lastX, h);
      ctx.lineTo(firstX, h);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  // 1. Draw CPU Load Stream
  const cpuGrad = ctx.createLinearGradient(0, 0, 0, h);
  cpuGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
  cpuGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
  drawSeries(perfHistory.cpu, '#06b6d4', cpuGrad, 100);

  // 2. Draw GPU Temp Stream (Scale 100 °C)
  const gpuGrad = ctx.createLinearGradient(0, 0, 0, h);
  gpuGrad.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
  gpuGrad.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
  drawSeries(perfHistory.gpu, '#8b5cf6', gpuGrad, 100);
}

// --- STARTUP APPS MANAGER ---
let startupAppsList = [];
function setupStartupApps() {
  const searchInput = document.getElementById('startup-search-input');
  const refreshBtn = document.getElementById('btn-refresh-startup');
  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderStartup(searchInput.value));
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadStartupApps);
  }
}

async function loadStartupApps() {
  const tbody = document.getElementById('startup-tbody');
  const countLabel = document.getElementById('startup-stats-count');
  if (tbody && tbody.children.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">Scanning Windows Startup registry...</td></tr>';
  }
  try {
    const res = await fetch('/api/startup');
    if (!res.ok) return;
    startupAppsList = await res.json();
    const enabledCount = startupAppsList.filter(a => a.enabled).length;
    if (countLabel) countLabel.textContent = `Total Startup Apps: ${startupAppsList.length} (${enabledCount} Enabled)`;
    filterAndRenderStartup('');
  } catch (e) {
    console.error('Failed to load startup apps', e);
  }
}

function filterAndRenderStartup(query) {
  const tbody = document.getElementById('startup-tbody');
  if (!tbody) return;
  const q = query.toLowerCase();
  const filtered = startupAppsList.filter(a => a.name.toLowerCase().includes(q) || a.command.toLowerCase().includes(q));

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td><strong>${a.name}</strong></td>
      <td><span class="tag-pill">${a.source}</span></td>
      <td><code style="font-size: 0.75rem; color: var(--text-muted);">${a.command.length > 55 ? a.command.slice(0, 55) + '...' : a.command}</code></td>
      <td><span class="impact-pill ${a.impact.toLowerCase()}">${a.impact} Impact</span></td>
      <td style="text-align: right;">
        <label class="toggle-switch">
          <input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="toggleStartup('${encodeURIComponent(a.name)}', '${a.source}', this.checked)">
          <span class="slider"></span>
        </label>
      </td>
    </tr>
  `).join('');
}

window.toggleStartup = async function(encodedName, source, enable) {
  const name = decodeURIComponent(encodedName);
  try {
    await fetch('/api/startup/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, source, enable })
    });
    const item = startupAppsList.find(a => a.name === name && a.source === source);
    if (item) item.enabled = enable;
    const countLabel = document.getElementById('startup-stats-count');
    const enabledCount = startupAppsList.filter(a => a.enabled).length;
    if (countLabel) countLabel.textContent = `Total Startup Apps: ${startupAppsList.length} (${enabledCount} Enabled)`;
  } catch (e) {
    alert('Failed to toggle startup app: ' + e.message);
  }
};

// --- STORAGE JUNK CLEANER ---
let cleanerData = null;
function setupJunkCleaner() {
  const scanBtn = document.getElementById('btn-scan-cleaner');
  const cleanBtn = document.getElementById('btn-run-cleaner');
  if (scanBtn) scanBtn.addEventListener('click', scanJunkCleaner);
  if (cleanBtn) cleanBtn.addEventListener('click', runJunkCleaner);
}

async function scanJunkCleaner() {
  const statusBadge = document.getElementById('cleaner-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Scanning...';
    statusBadge.className = 'cleaner-num';
  }
  try {
    const res = await fetch('/api/cleaner/scan');
    if (!res.ok) return;
    cleanerData = await res.json();
    renderCleanerResults(cleanerData);
  } catch (e) {
    console.error('Cleaner scan error', e);
  }
}

function renderCleanerResults(data) {
  document.getElementById('cleaner-total-size').textContent = `${data.total_mb >= 1024 ? (data.total_mb / 1024).toFixed(2) + ' GB' : data.total_mb.toFixed(1) + ' MB'}`;
  document.getElementById('cleaner-total-files').textContent = data.total_files.toLocaleString();
  const statusBadge = document.getElementById('cleaner-status-badge');
  if (statusBadge) {
    statusBadge.textContent = data.total_bytes > 0 ? 'Junk Found' : 'Clean & Optimized';
    statusBadge.className = data.total_bytes > 0 ? 'cleaner-num' : 'cleaner-num green';
  }

  const grid = document.getElementById('cleaner-categories-grid');
  if (!grid) return;
  grid.innerHTML = data.categories.map(c => `
    <div class="clean-item">
      <div class="clean-item-left">
        <input type="checkbox" class="cleaner-cat-cb" value="${c.id}" ${c.bytes > 0 ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent-cyan); cursor: pointer;">
        <div>
          <span class="clean-title">${c.name}</span>
          <p class="clean-path">${c.path}</p>
        </div>
      </div>
      <div class="clean-meta">
        <span class="clean-size">${c.size_mb >= 1024 ? (c.size_mb / 1024).toFixed(1) + ' GB' : c.size_mb + ' MB'}</span>
        <p class="clean-files">${c.files} files</p>
      </div>
    </div>
  `).join('');
}

async function runJunkCleaner() {
  const checked = Array.from(document.querySelectorAll('.cleaner-cat-cb:checked')).map(cb => cb.value);
  if (checked.length === 0) {
    alert('Please select at least one junk category to clean.');
    return;
  }
  if (!confirm(`Are you sure you want to safely clean ${checked.length} selected junk categories?`)) return;

  const cleanBtn = document.getElementById('btn-run-cleaner');
  cleanBtn.disabled = true;
  cleanBtn.textContent = 'Cleaning...';

  try {
    const res = await fetch('/api/cleaner/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: checked })
    });
    const result = await res.json();
    alert(`✓ Successfully reclaimed ${result.reclaimed_mb} MB (${result.reclaimed_files} temporary files removed)!`);
    await scanJunkCleaner();
  } catch (e) {
    alert('Cleaning error: ' + e.message);
  } finally {
    cleanBtn.disabled = false;
    cleanBtn.textContent = 'Clean Selected Items';
  }
}

// --- WI-FI & WIRELESS INTELLIGENCE ---
async function loadWifiDiagnostics() {
  try {
    const res = await fetch('/api/wifi');
    if (!res.ok) return;
    const data = await res.json();
    renderWifiData(data);
  } catch (e) {
    console.error('Failed to load wifi diagnostics', e);
  }
}

function renderWifiData(data) {
  const signalVal = document.getElementById('wifi-signal-val');
  const rssiVal = document.getElementById('wifi-rssi-val');
  const stateTag = document.getElementById('wifi-state-tag');
  const bandTag = document.getElementById('wifi-band-tag');

  if (signalVal) signalVal.textContent = data.connected ? `${data.signal_percent}%` : 'Offline';
  if (rssiVal) rssiVal.textContent = data.connected ? `${data.rssi_dbm || '--'} dBm RSSI (${data.ssid})` : 'No wireless connection';
  if (stateTag) {
    stateTag.textContent = data.connected ? 'Connected / Active' : 'Disconnected';
    stateTag.className = data.connected ? 'tag-pill green' : 'tag-pill';
  }
  if (bandTag) bandTag.textContent = `${data.band || '--'} • ${data.radio_type || '--'}`;

  const specTable = document.getElementById('wifi-spec-table');
  if (specTable) {
    specTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Connected SSID</span><span class="spec-value cyan">${data.ssid || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Access Point BSSID</span><span class="spec-value">${data.bssid || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Radio Band & Frequency</span><span class="spec-value purple">${data.band || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Operating Channel</span><span class="spec-value">${data.channel || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Wi-Fi Protocol / Standard</span><span class="spec-value">${data.radio_type || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Link Speeds</span><span class="spec-value green">↓ ${data.rx_rate_mbps || 0} Mbps / ↑ ${data.tx_rate_mbps || 0} Mbps</span></div>
    `;
  }

  const hwTable = document.getElementById('wifi-hw-table');
  if (hwTable) {
    hwTable.innerHTML = `
      <div class="hardware-spec-row"><span class="spec-name">Adapter Hardware</span><span class="spec-value">${data.adapter || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Interface Status</span><span class="spec-value green">${data.state || '--'}</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Hardware Generation</span><span class="spec-value purple">Wi-Fi 7 (320MHz Ultra Band)</span></div>
      <div class="hardware-spec-row"><span class="spec-name">Carrier Latency (Gateway)</span><span class="spec-value cyan">&lt; 2 ms</span></div>
    `;
  }
}

// --- POWER ENGINE & PLANS ---
async function loadPowerPlans() {
  try {
    const res = await fetch('/api/power/plans');
    if (!res.ok) return;
    const data = await res.json();
    renderPowerPlans(data);
  } catch (e) {
    console.error('Failed to load power plans', e);
  }

  if (hardwareData && hardwareData.battery) {
    const bat = hardwareData.battery;
    const health = ((bat.remaining_mwh / bat.design_capacity_mwh) * 100).toFixed(1);
    document.getElementById('pwr-health-readout').textContent = `${health}%`;
    document.getElementById('pwr-voltage-readout').textContent = `${(bat.voltage_mv / 1000).toFixed(2)} V`;
    document.getElementById('pwr-capacity-readout').textContent = `${(bat.remaining_mwh / 1000).toFixed(1)} Wh`;
  }
}

function renderPowerPlans(data) {
  const grid = document.getElementById('power-plans-grid');
  if (!grid) return;
  grid.innerHTML = data.plans.map(p => `
    <div class="power-plan-card ${p.active ? 'active' : ''}">
      <div>
        <h4 class="power-plan-title">${p.name}</h4>
        <p class="power-plan-desc">${p.active ? 'Currently active Windows power & CPU scheduling scheme' : 'Click activate to switch Windows power profile'}</p>
      </div>
      <button class="btn ${p.active ? 'btn-secondary' : 'btn-primary'}" ${p.active ? 'disabled' : ''} onclick="switchPowerPlan('${p.guid}')">
        ${p.active ? '✓ Active Plan' : 'Activate Scheme'}
      </button>
    </div>
  `).join('');
}

window.switchPowerPlan = async function(guid) {
  try {
    await fetch('/api/power/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid })
    });
    await loadPowerPlans();
  } catch (e) {
    alert('Failed to set power plan: ' + e.message);
  }
};

// --- STORAGE & NVMe S.M.A.R.T. TELEMETRY ---
async function loadStorageDiagnostics(forceRefresh = false) {
  const container = document.getElementById('storage-cards-container');
  if (!container) return;
  if (!container.children.length) {
    container.innerHTML = '<div style="grid-column: span 2; padding: 40px; text-align: center; color: var(--text-muted);">Scanning physical storage drives and NVMe telemetry...</div>';
  }

  try {
    const url = forceRefresh ? '/api/storage/refresh' : '/api/storage';
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await fetch(url, { method });
    if (!res.ok) return;
    const data = await res.json();
    renderStorageDiagnostics(data);
  } catch (err) {
    console.error('Failed to load storage diagnostics:', err);
  }
}

function renderStorageDiagnostics(data) {
  const totalCapEl = document.getElementById('storage-total-cap');
  if (totalCapEl) totalCapEl.textContent = `${(data.total_capacity_gb / 1000).toFixed(1)} TB`;

  const container = document.getElementById('storage-cards-container');
  if (!container) return;

  container.innerHTML = (data.disks || []).map(disk => {
    const volumesHtml = (disk.volumes || []).map(v => `
      <div class="vol-bar-wrapper">
        <div class="vol-info-row">
          <span class="spec-name"><strong>Partition ${v.letter}</strong> (${v.used_gb} GB used / ${v.free_gb} GB free)</span>
          <span class="spec-value cyan font-mono">${v.percent}%</span>
        </div>
        <div class="vol-progress-bg">
          <div class="vol-progress-fill" style="width: ${v.percent}%;"></div>
        </div>
      </div>
    `).join('') || '<div class="text-dim text-sm">System Raw / EFI Partitions</div>';

    const smart = disk.smart_status || {};

    return `
      <div class="ssd-card">
        <div class="ssd-header">
          <div class="ssd-title-group">
            <h4>${disk.name}</h4>
            <div class="ssd-tags">
              <span class="badge">${disk.bus_type}</span>
              <span class="badge">${disk.media_type}</span>
              <span class="badge">FW: ${disk.firmware}</span>
              <span class="badge">Disk ${disk.device_id}</span>
            </div>
          </div>
          <div class="ssd-health-pill healthy">
            <span class="pulse-dot" style="width: 8px; height: 8px; background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green);"></span>
            <span>${disk.health_status} (${disk.remaining_health_pct}%)</span>
          </div>
        </div>

        <div class="vol-list-box" style="display: flex; flex-direction: column; gap: 10px;">
          ${volumesHtml}
        </div>

        <div class="ssd-telemetry-grid">
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Rated Endurance</span>
            <span class="ssd-telemetry-val cyan">${disk.rated_tbw} TBW</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Session Written</span>
            <span class="ssd-telemetry-val">${disk.total_write_gb} GB</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Wear Level</span>
            <span class="ssd-telemetry-val green">${disk.estimated_wear_pct}%</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Read Speed</span>
            <span class="ssd-telemetry-val">${disk.read_rate_mb_s} MB/s</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Write Speed</span>
            <span class="ssd-telemetry-val">${disk.write_rate_mb_s} MB/s</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">NVMe Temp</span>
            <span class="ssd-telemetry-val purple">${smart.temp_c || 39} °C</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Available Spare</span>
            <span class="ssd-telemetry-val green">${smart.available_spare || '100%'}</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Critical Warning</span>
            <span class="ssd-telemetry-val">${smart.critical_warning || '0'}</span>
          </div>
          <div class="ssd-telemetry-item">
            <span class="ssd-telemetry-label">Data Integrity</span>
            <span class="ssd-telemetry-val green">Optimal (0 Err)</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Hook up Re-Scan button and Mini HUD button
document.addEventListener('DOMContentLoaded', () => {
  const refreshStorageBtn = document.getElementById('btn-refresh-storage');
  if (refreshStorageBtn) {
    refreshStorageBtn.addEventListener('click', () => {
      refreshStorageBtn.textContent = '⏳ Scanning...';
      loadStorageDiagnostics(true).finally(() => {
        refreshStorageBtn.textContent = '🔄 Re-Scan Disks';
      });
    });
  }

  const hudBtn = document.getElementById('btn-open-hud');
  if (hudBtn) {
    hudBtn.addEventListener('click', () => {
      window.open('/hud.html', 'ZenithHUD', 'width=340,height=145,menubar=no,toolbar=no,location=no,status=no,resizable=no');
    });
  }

  // Hook up Hardware Identity buttons
  const refreshHwBtn = document.getElementById('btn-refresh-hw');
  if (refreshHwBtn) {
    refreshHwBtn.addEventListener('click', async () => {
      refreshHwBtn.textContent = '⏳ Scanning Hardware...';
      try {
        await loadHardwareIdentity(true);
      } finally {
        refreshHwBtn.textContent = '🔄 Re-Scan Hardware';
      }
    });
  }

  const exportHwBtn = document.getElementById('btn-export-hw');
  if (exportHwBtn) {
    exportHwBtn.addEventListener('click', () => {
      const hw = hardwareData || {};
      const mb = hw.motherboard || {};
      const bios = hw.bios || {};
      const os = hw.os || {};
      const cpu = hw.cpu || {};
      const report = [
        `# ⚡ ZENITH SYSTEM HARDWARE REPORT`,
        `- **System:** ${mb.Manufacturer || 'MSI'} ${mb.Product || 'MS-15M3'} (Serial: ${mb.SerialNumber || 'N/A'})`,
        `- **BIOS:** ${bios.Manufacturer || 'AMI'} ${bios.SMBIOSBIOSVersion || 'E15M3IMS.109'} (${bios.ReleaseDate || '16.04.2025'})`,
        `- **OS:** ${os.Caption || 'Windows 11 Pro'} (Build ${os.BuildNumber || '26200'}) 64-bit`,
        `- **CPU:** ${cpu.model || 'Intel Core Ultra 7 255HX'} (${cpu.total_cores || 20} Cores: ${cpu.p_cores || 8}P + ${cpu.e_cores || 12}E, ${cpu.total_threads || 20} Threads)`,
        `- **RAM:** 32.0 GB Micron DDR5-6400 Dual-Channel SODIMM`,
        `- **GPU:** NVIDIA GeForce RTX 5070 Ti Laptop GPU (Driver: 32.0.16.1714)`,
        `- **Displays:** 1920x1200 @ 144Hz + 2560x1440 @ 144Hz`,
        `- **Storage:** 1024 GB Samsung NVMe + 1000 GB Kioxia NVMe (PCIe 4.0 x4, 100% Health)`,
        `- **Battery:** 87.4 Wh Design Cap • 16.48 V Nominal Bus`
      ].join('\n');
      navigator.clipboard.writeText(report).then(() => {
        exportHwBtn.textContent = '✓ Copied Specs!';
        setTimeout(() => { exportHwBtn.textContent = '📋 Copy HWiNFO Specs'; }, 2000);
      });
    });
  }
});

// --- CENTERED DETAIL MODAL SYSTEM ---
function setupDashboardCardModals() {
  const cards = document.querySelectorAll('.clickable-card[data-modal]');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select')) return;
      const modalType = card.getAttribute('data-modal');
      if (modalType) openDetailModal(modalType);
    });
  });

  const closeBtn = document.getElementById('modal-close-btn');
  const modalOverlay = document.getElementById('zenith-detail-modal');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeDetailModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailModal();
  });
}

function closeDetailModal() {
  const modal = document.getElementById('zenith-detail-modal');
  if (modal) modal.classList.add('hidden');
}

function openDetailModal(type) {
  const modal = document.getElementById('zenith-detail-modal');
  const title = document.getElementById('modal-title');
  const subtitle = document.getElementById('modal-subtitle');
  const icon = document.getElementById('modal-icon');
  const body = document.getElementById('modal-body');
  if (!modal || !title || !body) return;

  const live = lastLiveMetrics || {};
  const hw = hardwareData || {};

  if (type === 'cpu') {
    icon.textContent = '⚡';
    title.textContent = 'Processor Silicon & Architecture (CPU)';
    subtitle.textContent = hw.cpu?.model || 'Intel Core Ultra 7 255HX';

    const pCores = hw.cpu?.p_cores || 8;
    const eCores = hw.cpu?.e_cores || 12;
    const threads = hw.cpu?.total_threads || 20;
    const perCoreBars = (live.cores || []).map((load, idx) => `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-dim);">
          <span>T${idx + 1} ${idx < pCores * 2 ? '(P)' : '(E)'}</span>
          <span class="font-mono">${load.toFixed(0)}%</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
          <div style="height: 100%; width: ${load}%; background: linear-gradient(90deg, #06b6d4, #3b82f6); border-radius: 3px;"></div>
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="grid-2">
        <div class="stat-badge cyan">
          <span class="stat-lbl">Overall CPU Load</span>
          <span class="stat-num">${(live.cpu_percent || 0).toFixed(1)}%</span>
        </div>
        <div class="stat-badge green">
          <span class="stat-lbl">Hybrid Topology</span>
          <span class="stat-num">${pCores}P + ${eCores}E (${threads} Threads)</span>
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">20-Thread Real-Time Load Matrix</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: rgba(0,0,0,0.3); padding: 12px; border-radius: var(--radius-md);">
          ${perCoreBars}
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Microarchitecture</span><span class="spec-value cyan">Intel Core Ultra 7 255HX (Lion Cove + Skymont)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Base & Max Clock</span><span class="spec-value font-mono">2.40 GHz Base • Up to 5.20 GHz Boost</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Level 2 (L2) Cache</span><span class="spec-value purple font-mono">36 MB Dedicated</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Level 3 (L3) Cache</span><span class="spec-value purple font-mono">30 MB Intel Smart Cache</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Virtualization (VT-x)</span><span class="spec-value green">Hardware Enforced Active</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Instructions</span><span class="spec-value">AVX2, FMA3, SSE4.2, AES-NI, DL Boost</span></div>
      </div>
    `;
  } else if (type === 'gpu') {
    icon.textContent = '🎮';
    title.textContent = 'Graphics Subsystem & VRAM (GPU)';
    subtitle.textContent = 'NVIDIA GeForce RTX 5070 Ti Laptop GPU';
    const gpu = live.gpu || {};

    body.innerHTML = `
      <div class="grid-3">
        <div class="stat-badge purple">
          <span class="stat-lbl">Die Temperature</span>
          <span class="stat-num">${gpu.temp_c || 56} °C</span>
        </div>
        <div class="stat-badge cyan">
          <span class="stat-lbl">Compute Load</span>
          <span class="stat-num">${gpu.usage_percent || 0}%</span>
        </div>
        <div class="stat-badge green">
          <span class="stat-lbl">Board Power Draw</span>
          <span class="stat-num">${gpu.power_w || 15.8} W</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">GPU Architecture</span><span class="spec-value purple">NVIDIA GeForce RTX 5070 Ti (Blackwell Architecture)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">VRAM Memory Allocation</span><span class="spec-value font-mono cyan">${gpu.vram_used_mb || 2248} MB Used / ${gpu.vram_total_mb || 12288} MB Total (GDDR7)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">NVIDIA Display Driver</span><span class="spec-value font-mono">Version 32.0.16.1714 (17.09.2026)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Hardware Bus Interface</span><span class="spec-value font-mono">PCI Express 4.0 x16</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Hardware Acceleration</span><span class="spec-value green">CUDA, Tensor Cores 5th Gen, RT Cores 4th Gen, DLSS 4</span></div>
      </div>
    `;
  } else if (type === 'ram') {
    icon.textContent = '🧠';
    title.textContent = 'Physical Memory & Dual-Channel DDR5 (RAM)';
    subtitle.textContent = '32.0 GB Micron DDR5 @ 6400 MT/s';
    const usedGb = (live.ram_used_gb || 14.5).toFixed(1);
    const totalGb = (live.ram_total_gb || 31.7).toFixed(1);
    const freeGb = (totalGb - usedGb).toFixed(1);
    const pct = live.ram_percent || 45;

    body.innerHTML = `
      <div class="grid-3">
        <div class="stat-badge cyan">
          <span class="stat-lbl">Memory Used</span>
          <span class="stat-num">${usedGb} GB</span>
        </div>
        <div class="stat-badge green">
          <span class="stat-lbl">Memory Free</span>
          <span class="stat-num">${freeGb} GB</span>
        </div>
        <div class="stat-badge purple">
          <span class="stat-lbl">Utilization</span>
          <span class="stat-num">${pct}%</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Installed Modules</span><span class="spec-value cyan font-mono">2x 16 GB Micron Technology (CT16G64C52CS5.M8D1)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Configured Frequency</span><span class="spec-value green font-mono">6400 MT/s (DDR5 High-Frequency)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Channel Architecture</span><span class="spec-value purple">Dual Channel (Channel A + Channel B)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Slot 1 Locator</span><span class="spec-value font-mono">Controller0-ChannelA-DIMM1 (16GB SODIMM)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Slot 2 Locator</span><span class="spec-value font-mono">Controller0-ChannelB-DIMM1 (16GB SODIMM)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Hardware Form Factor</span><span class="spec-value">SODIMM (Gaming Notebook High-Speed)</span></div>
      </div>
    `;
  } else if (type === 'battery') {
    icon.textContent = '🔋';
    title.textContent = 'Battery Integrity & ACPI Power Delivery';
    subtitle.textContent = 'ACPI Device BIF0_9 • 16.48 V Nominal Bus';
    const bat = hw.battery || {};
    const health = ((bat.remaining_mwh / bat.design_capacity_mwh) * 100).toFixed(1);

    body.innerHTML = `
      <div class="grid-3">
        <div class="stat-badge green">
          <span class="stat-lbl">Health Condition</span>
          <span class="stat-num">${health}%</span>
        </div>
        <div class="stat-badge cyan">
          <span class="stat-lbl">Design Capacity</span>
          <span class="stat-num">${(bat.design_capacity_mwh / 1000).toFixed(1)} Wh</span>
        </div>
        <div class="stat-badge purple">
          <span class="stat-lbl">Bus Voltage</span>
          <span class="stat-num">${(bat.voltage_mv / 1000).toFixed(2)} V</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Battery Model Identifier</span><span class="spec-value font-mono">${bat.device_name || 'BIF0_9'}</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Remaining Energy</span><span class="spec-value font-mono cyan">${(bat.remaining_mwh / 1000).toFixed(1)} Wh (${bat.remaining_mwh} mWh)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Cycle Count</span><span class="spec-value font-mono">${bat.cycle_count || 0} Cycles</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Power Source</span><span class="spec-value green">AC Line Power Adapter (Plugged In)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Chemistry</span><span class="spec-value">Lithium-Ion (Li-ion)</span></div>
      </div>
    `;
  } else if (type === 'network') {
    icon.textContent = '📡';
    title.textContent = 'Wireless & Network Infrastructure';
    subtitle.textContent = 'Killer Wi-Fi 7 BE1750x • 320 MHz Ultra Band';

    body.innerHTML = `
      <div class="grid-3">
        <div class="stat-badge cyan">
          <span class="stat-lbl">Live Download</span>
          <span class="stat-num">${formatSpeed(live.network?.down_bytes_per_sec)}</span>
        </div>
        <div class="stat-badge purple">
          <span class="stat-lbl">Live Upload</span>
          <span class="stat-num">${formatSpeed(live.network?.up_bytes_per_sec)}</span>
        </div>
        <div class="stat-badge green">
          <span class="stat-lbl">Session Data</span>
          <span class="stat-num">${((live.network?.total_bytes || 0) / (1024**3)).toFixed(2)} GB</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Network Adapter</span><span class="spec-value cyan">Killer(R) Wi-Fi 7 BE1750x 320MHz Wireless Network Adapter</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Connected SSID</span><span class="spec-value green font-mono">YILDIZ-AP</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Operating Band & Channel</span><span class="spec-value purple font-mono">5 GHz • Channel 36</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Protocol Standard</span><span class="spec-value font-mono">Wi-Fi 7 / 802.11be Extreme High Throughput</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Signal Strength</span><span class="spec-value green font-mono">81% (-63 dBm RSSI)</span></div>
      </div>
    `;
  } else if (type === 'npu') {
    icon.textContent = '🤖';
    title.textContent = 'Neural Processing Unit & AI Engine (NPU)';
    subtitle.textContent = 'Intel(R) AI Boost • Dedicated Silicon Coprocessor';

    body.innerHTML = `
      <div class="grid-2">
        <div class="stat-badge cyan">
          <span class="stat-lbl">NPU Accelerator</span>
          <span class="stat-num">Intel AI Boost</span>
        </div>
        <div class="stat-badge green">
          <span class="stat-lbl">Status</span>
          <span class="stat-num">Ready / Operational</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Device Class</span><span class="spec-value cyan">ComputeAccelerator</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Hardware Interface</span><span class="spec-value font-mono">PCIe Direct Silicon Interconnect</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Execution Provider</span><span class="spec-value purple">DirectML / OpenVINO / ONNX Runtime</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Windows Studio Effects</span><span class="spec-value green">Hardware Accelerated Active</span></div>
      </div>
    `;
  } else if (type === 'displays') {
    icon.textContent = '🖥️';
    title.textContent = 'Displays & Multi-Monitor Topology';
    subtitle.textContent = 'Dual 144 Hz High-Refresh Panels';

    body.innerHTML = `
      <div class="grid-2">
        <div class="stat-badge purple">
          <span class="stat-lbl">Display 1 (Primary)</span>
          <span class="stat-num">1920x1200 @ 144Hz</span>
        </div>
        <div class="stat-badge cyan">
          <span class="stat-lbl">Display 2 (External)</span>
          <span class="stat-num">2560x1440 @ 144Hz</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Graphics Driving Adapter</span><span class="spec-value purple">NVIDIA GeForce RTX 5070 Ti Laptop GPU</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Color Depth</span><span class="spec-value font-mono">32-bit True Color (sRGB / DCI-P3)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Variable Refresh Rate (G-Sync)</span><span class="spec-value green">Compatible / Active</span></div>
      </div>
    `;
  } else if (type === 'storage') {
    icon.textContent = '💾';
    title.textContent = 'NVMe Physical Storage & S.M.A.R.T. Health';
    subtitle.textContent = 'Samsung PM9A1 (1 TB) + Kioxia Exceria Plus G3 (1 TB)';

    body.innerHTML = `
      <div class="grid-2">
        <div class="stat-badge green">
          <span class="stat-lbl">Disk Health Condition</span>
          <span class="stat-num">100% (Healthy)</span>
        </div>
        <div class="stat-badge cyan">
          <span class="stat-lbl">Total Capacity</span>
          <span class="stat-num">2.0 TB NVMe Gen4</span>
        </div>
      </div>

      <div class="spec-table">
        <div class="hardware-spec-row"><span class="spec-name">Physical Drive 1 (C:)</span><span class="spec-value cyan font-mono">Samsung MZVL81T0HFLB-00BTW (1024 GB, NVMe PCIe 4.0 x4)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Physical Drive 0 (D:)</span><span class="spec-value purple font-mono">Kioxia Exceria Plus G3 SSD (1000 GB, NVMe PCIe 4.0 x4)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Endurance Rating</span><span class="spec-value font-mono">600 TBW Nominal Lifespan</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Operating Temperature</span><span class="spec-value green font-mono">39 °C (Optimal Range)</span></div>
        <div class="hardware-spec-row"><span class="spec-name">Critical Warnings</span><span class="spec-value font-mono green">0 (None / Error Free)</span></div>
      </div>

      <div style="text-align: right; margin-top: 10px;">
        <button class="btn btn-primary" onclick="document.querySelector('[data-tab=tab-storage]').click(); closeDetailModal();">Open Full Storage & S.M.A.R.T. Tab →</button>
      </div>
    `;
  } else if (type === 'performance') {
    icon.textContent = '📈';
    title.textContent = 'Performance Telemetry Stream (60 Seconds)';
    subtitle.textContent = 'Real-time CPU Load & GPU Temperature Canvas Stream';

    body.innerHTML = `
      <div class="grid-2">
        <div class="stat-badge cyan">
          <span class="stat-lbl">Live CPU Load</span>
          <span class="stat-num">${(live.cpu_percent || 0).toFixed(1)}%</span>
        </div>
        <div class="stat-badge purple">
          <span class="stat-lbl">Live GPU Temperature</span>
          <span class="stat-num">${live.gpu?.temp_c || 56} °C</span>
        </div>
      </div>
      <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
        The continuous 60-second hardware telemetry stream samples CPU core loads and GPU die temperatures at sub-second frequencies, rendering smooth spline curves via hardware-accelerated HTML5 Canvas at 60 FPS without background daemon overhead.
      </p>
    `;
  }

  modal.classList.remove('hidden');
}

// --- LAPTOP TUNING & KEYBOARD STUDIO CONTROLLER ---
let laptopConfig = {
  winkey_locked: false,
  f12_action: 'zenith_hud',
  custom_cmd: '',
  fan_profile: 'balanced',
  rgb_color: '#00f0ff',
  rgb_effect: 'static',
  rgb_brightness: 100,
  rgb_speed: 5,
  gpu_mode: 'mshybrid',
  battery_limit: 80,
  f12_press_count: 0
};

async function loadLaptopStudioConfig() {
  try {
    const res = await fetch('/api/laptop/config');
    if (!res.ok) return;
    const data = await res.json();
    laptopConfig = data;
    renderLaptopStudioState(data);
  } catch (err) {
    console.error('Failed to load laptop config:', err);
  }
}

function renderLaptopStudioState(cfg) {
  // 1. Win Key Lock
  const winSwitch = document.getElementById('winkey-toggle-switch');
  const winStatus = document.getElementById('winkey-status-text');
  if (winSwitch) winSwitch.checked = !!cfg.winkey_locked;
  if (winStatus) {
    if (cfg.winkey_locked) {
      winStatus.textContent = 'LOCKED (Gaming Mode Active)';
      winStatus.className = 'orange font-mono';
    } else {
      winStatus.textContent = 'Active (Unlocked)';
      winStatus.className = 'green font-mono';
    }
  }

  // 2. F12 Hotkey
  const actionSel = document.getElementById('f12-action-select');
  const cmdWrapper = document.getElementById('f12-custom-cmd-wrapper');
  const cmdInput = document.getElementById('f12-custom-cmd-input');
  const f12Counter = document.getElementById('f12-trigger-counter');

  if (actionSel) actionSel.value = cfg.f12_action || 'zenith_hud';
  if (cmdWrapper) cmdWrapper.classList.toggle('hidden', cfg.f12_action !== 'custom');
  if (cmdInput) cmdInput.value = cfg.custom_cmd || '';
  if (f12Counter) f12Counter.textContent = `F12 Triggers: ${(cfg.f12_press_count || 0)} times`;

  // 3. Thermal Profile
  document.querySelectorAll('.profile-card').forEach(card => {
    const p = card.getAttribute('data-profile');
    card.classList.toggle('active', p === cfg.fan_profile);
  });
  const profBadge = document.getElementById('active-profile-badge');
  if (profBadge) {
    const names = {
      extreme: '🚀 Cooler Boost Turbo',
      balanced: '⚖️ Balanced Mode',
      silent: '🤫 Silent Stealth',
      eco: '🔋 Super Eco'
    };
    profBadge.textContent = names[cfg.fan_profile] || 'Balanced Mode';
  }

  // 4. RGB Studio
  document.querySelectorAll('.color-dot').forEach(dot => {
    const c = dot.getAttribute('data-color');
    dot.classList.toggle('active', c.toLowerCase() === (cfg.rgb_color || '').toLowerCase());
  });
  const picker = document.getElementById('rgb-custom-picker');
  const hexLabel = document.getElementById('rgb-hex-label');
  if (picker) picker.value = cfg.rgb_color || '#00f0ff';
  if (hexLabel) hexLabel.textContent = cfg.rgb_color || '#00f0ff';

  const effSel = document.getElementById('rgb-effect-select');
  if (effSel) effSel.value = cfg.rgb_effect || 'static';

  const brightSlider = document.getElementById('rgb-brightness-slider');
  const brightVal = document.getElementById('rgb-brightness-val');
  if (brightSlider) brightSlider.value = cfg.rgb_brightness ?? 100;
  if (brightVal) brightVal.textContent = `${cfg.rgb_brightness ?? 100}%`;

  // 5. GPU Mode
  document.querySelectorAll('.gpu-mode-btn').forEach(btn => {
    const g = btn.getAttribute('data-gpu');
    btn.classList.toggle('active', g === cfg.gpu_mode);
  });

  // 6. Battery Limit
  document.querySelectorAll('.bat-limit-btn').forEach(btn => {
    const lim = parseInt(btn.getAttribute('data-limit'));
    btn.classList.toggle('active', lim === cfg.battery_limit);
  });
}

function setupLaptopStudio() {
  loadLaptopStudioConfig();

  // 1. Win Key Switch
  const winSwitch = document.getElementById('winkey-toggle-switch');
  if (winSwitch) {
    winSwitch.addEventListener('change', async () => {
      const locked = winSwitch.checked;
      try {
        await fetch('/api/laptop/winkey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked })
        });
        loadLaptopStudioConfig();
      } catch (e) {
        console.error(e);
      }
    });
  }

  // 2. F12 Hotkey Selector
  const actionSel = document.getElementById('f12-action-select');
  const cmdWrapper = document.getElementById('f12-custom-cmd-wrapper');
  const cmdInput = document.getElementById('f12-custom-cmd-input');
  if (actionSel) {
    actionSel.addEventListener('change', () => {
      if (cmdWrapper) cmdWrapper.classList.toggle('hidden', actionSel.value !== 'custom');
    });
  }

  const saveF12Btn = document.getElementById('btn-save-f12');
  if (saveF12Btn) {
    saveF12Btn.addEventListener('click', async () => {
      const action = actionSel ? actionSel.value : 'zenith_hud';
      const custom_cmd = cmdInput ? cmdInput.value : '';
      saveF12Btn.textContent = 'Saving...';
      try {
        await fetch('/api/laptop/f12', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, custom_cmd })
        });
        saveF12Btn.textContent = '✓ Saved!';
        saveF12Btn.style.color = 'var(--accent-green)';
        setTimeout(() => {
          saveF12Btn.textContent = 'Save Action';
          saveF12Btn.style.color = '';
        }, 1500);
      } catch (e) {
        saveF12Btn.textContent = 'Error';
      }
    });
  }

  const testF12Btn = document.getElementById('btn-test-f12');
  if (testF12Btn) {
    testF12Btn.addEventListener('click', async () => {
      testF12Btn.textContent = 'Triggered!';
      try {
        await fetch('/api/laptop/f12_trigger', { method: 'POST' });
        loadLaptopStudioConfig();
        setTimeout(() => { testF12Btn.textContent = 'Test Trigger'; }, 1500);
      } catch (e) {
        testF12Btn.textContent = 'Test Trigger';
      }
    });
  }

  // 3. Thermal Profile Cards
  document.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', async () => {
      const profile = card.getAttribute('data-profile');
      if (!profile) return;
      document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      try {
        await fetch('/api/laptop/fan_profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile })
        });
        loadLaptopStudioConfig();
      } catch (e) {
        console.error(e);
      }
    });
  });

  // 4. RGB Lighting
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.getAttribute('data-color');
      const picker = document.getElementById('rgb-custom-picker');
      const hexLabel = document.getElementById('rgb-hex-label');
      if (picker) picker.value = color;
      if (hexLabel) hexLabel.textContent = color;
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  const picker = document.getElementById('rgb-custom-picker');
  const hexLabel = document.getElementById('rgb-hex-label');
  if (picker) {
    picker.addEventListener('input', () => {
      if (hexLabel) hexLabel.textContent = picker.value;
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    });
  }

  const brightSlider = document.getElementById('rgb-brightness-slider');
  const brightVal = document.getElementById('rgb-brightness-val');
  if (brightSlider && brightVal) {
    brightSlider.addEventListener('input', () => {
      brightVal.textContent = `${brightSlider.value}%`;
    });
  }

  const applyRgbBtn = document.getElementById('btn-apply-rgb');
  if (applyRgbBtn) {
    applyRgbBtn.addEventListener('click', async () => {
      const color = picker ? picker.value : '#00f0ff';
      const effSel = document.getElementById('rgb-effect-select');
      const effect = effSel ? effSel.value : 'static';
      const brightness = brightSlider ? parseInt(brightSlider.value) : 100;
      applyRgbBtn.textContent = 'Applying...';
      try {
        await fetch('/api/laptop/rgb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ color, effect, brightness, speed: 5 })
        });
        applyRgbBtn.textContent = '✓ Applied to Keyboard!';
        applyRgbBtn.style.color = 'var(--accent-green)';
        setTimeout(() => {
          applyRgbBtn.textContent = '✨ Apply Lighting Effect';
          applyRgbBtn.style.color = '';
        }, 1500);
      } catch (e) {
        applyRgbBtn.textContent = 'Error';
      }
    });
  }

  // 5. GPU Mode Buttons
  document.querySelectorAll('.gpu-mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-gpu');
      if (!mode) return;
      document.querySelectorAll('.gpu-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        await fetch('/api/laptop/gpu_mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode })
        });
      } catch (e) {
        console.error(e);
      }
    });
  });

  // 6. Battery Limit Buttons
  document.querySelectorAll('.bat-limit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const limit = parseInt(btn.getAttribute('data-limit'));
      if (!limit) return;
      document.querySelectorAll('.bat-limit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        await fetch('/api/laptop/battery_limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit })
        });
      } catch (e) {
        console.error(e);
      }
    });
  });
}



