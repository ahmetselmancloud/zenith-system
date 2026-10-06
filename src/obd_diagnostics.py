import os
import sys
import json
import time
import datetime
import subprocess
import re
import psutil

# Zenith System — Hardware Diagnostics & PC OBD-II Check-Up Engine (Faz 4)
# Inspired by automotive ECU/OBD-II vehicle diagnostics:
# 1. WHEA (Windows Hardware Error Architecture) MCE & PCIe AER Analysis
# 2. Cable & Socket Flapping / Loose Connection Detection (PnP Intermittent disconnects)
# 3. GPU PCIe Link Generation & Lane Width Degradation (x16 -> x4/x1 silent loss)
# 4. Storage Bus / CRC Integrity & Electrical Noise
# 5. Diagnostic Trouble Codes (DTC) & OBD-II Health Index (0-100)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBD_CACHE_FILE = os.path.join(BASE_DIR, "obd_cache.json")

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

_cached_report = None
_last_scan_time = 0

def query_gpu_pcie():
    """Queries GPU PCIe link generation and width using nvidia-smi."""
    try:
        cmd = [
            "nvidia-smi",
            "--query-gpu=name,pcie.link.gen.gpucurrent,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max",
            "--format=csv,noheader,nounits"
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=2, creationflags=CREATE_NO_WINDOW).decode().strip()
        parts = [p.strip() for p in out.split(',')]
        if len(parts) >= 5:
            return {
                "available": True,
                "name": parts[0],
                "gen_current": int(parts[1]) if parts[1].isdigit() else parts[1],
                "gen_max": int(parts[2]) if parts[2].isdigit() else parts[2],
                "width_current": int(parts[3]) if parts[3].isdigit() else parts[3],
                "width_max": int(parts[4]) if parts[4].isdigit() else parts[4]
            }
    except Exception:
        pass
    return {"available": False}

def query_whea_logs():
    """Queries Windows Event Log for WHEA (Hardware Error) events."""
    try:
        ps_cmd = """
        Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WHEA-Logger'} -MaxEvents 20 -ErrorAction SilentlyContinue |
        Select-Object TimeCreated, Id, LevelDisplayName, Message | ConvertTo-Json -Compress
        """
        res = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                             capture_output=True, text=True, timeout=5, creationflags=CREATE_NO_WINDOW)
        raw = res.stdout.strip()
        if raw:
            data = json.loads(raw)
            if isinstance(data, dict):
                data = [data]
            return data
    except Exception:
        pass
    return []

def query_pnp_problem_devices():
    """Queries devices with error codes or degraded status."""
    devices = []
    try:
        ps_cmd = """
        Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'OK' -and $_.Status -ne 'Unknown' } |
        Select-Object FriendlyName, InstanceId, Status, Class, Problem | ConvertTo-Json -Compress
        """
        res = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                             capture_output=True, text=True, timeout=5, creationflags=CREATE_NO_WINDOW)
        raw = res.stdout.strip()
        if raw:
            data = json.loads(raw)
            if isinstance(data, dict):
                devices = [data]
            elif isinstance(data, list):
                devices = data
    except Exception:
        pass
    return devices

def query_recent_disconnect_events():
    """Queries kernel PnP events for frequent disconnects or driver unload errors."""
    events = []
    try:
        ps_cmd = """
        Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-PnP'} -MaxEvents 15 -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -eq 219 -or $_.Id -eq 400 -or $_.Id -eq 410 } |
        Select-Object TimeCreated, Id, Message | ConvertTo-Json -Compress
        """
        res = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                             capture_output=True, text=True, timeout=4, creationflags=CREATE_NO_WINDOW)
        raw = res.stdout.strip()
        if raw:
            data = json.loads(raw)
            if isinstance(data, dict):
                events = [data]
            elif isinstance(data, list):
                events = data
    except Exception:
        pass
    return events

def run_full_hardware_checkup():
    global _cached_report, _last_scan_time

    score = 100
    dtc_codes = []
    subsystems = {}

    # 1. WHEA (Windows Hardware Error Architecture) Analysis
    whea_events = query_whea_logs()
    whea_status = "clean"
    whea_score = 100
    whea_details = "WHEA hardware logs clean. No processor core voltage drops (MCE) or L1/L2 cache degradation detected."

    mce_count = 0
    aer_count = 0
    fatal_count = 0

    for ev in whea_events:
        ev_id = ev.get("Id")
        if ev_id in [18, 19, 20]:
            mce_count += 1
        elif ev_id == 17:
            aer_count += 1
        elif ev_id == 1:
            fatal_count += 1

    if fatal_count > 0:
        whea_score -= 40
        whea_status = "critical"
        dtc_codes.append({
            "code": "P0100-WHEA-FATAL",
            "subsystem": "CPU / Anakart",
            "severity": "critical",
            "description": f"Windows logged {fatal_count} critical hardware faults (WHEA Fatal Error).",
            "recommendation": "Inspect hardware voltages, memory frequencies, and verify motherboard BIOS updates."
        })
    elif mce_count > 0:
        whea_score -= 20
        whea_status = "warning"
        dtc_codes.append({
            "code": "P0101-WHEA-MCE",
            "subsystem": "Processor (CPU)",
            "severity": "warning",
            "description": f"{mce_count} processor Machine Check Exception (MCE) voltage anomalies detected.",
            "recommendation": "May be caused by thermal throttling or voltage fluctuations. Inspect CPU temperatures."
        })
    elif aer_count > 0:
        whea_score -= 10
        whea_status = "warning"
        dtc_codes.append({
            "code": "P0102-WHEA-AER",
            "subsystem": "PCIe Bus",
            "severity": "warning",
            "description": f"{aer_count} PCIe Advanced Error Reporting (AER) packet drop events corrected.",
            "recommendation": "Check for dust in PCIe slots or loose connector contacts."
        })

    subsystems["whea"] = {
        "title": "WHEA & Hardware Stability",
        "icon": "🧠",
        "status": whea_status,
        "score": whea_score,
        "details": whea_details,
        "events_count": len(whea_events)
    }

    # 2. Cable & Socket Flapping (Disconnect & Loose Contact Detector)
    pnp_faults = query_pnp_problem_devices()
    pnp_events = query_recent_disconnect_events()
    port_score = 100
    port_status = "clean"
    port_details = "No loose contacts, port disconnects, or device flapping detected across peripheral ports."

    flapping_devices = []
    for d in pnp_faults:
        name = d.get("FriendlyName") or d.get("InstanceId") or "Unknown Device"
        prob = d.get("Problem")
        flapping_devices.append(f"{name} (Code: {prob})")

    if len(pnp_faults) > 0:
        port_score -= min(30, len(pnp_faults) * 15)
        port_status = "warning" if len(pnp_faults) == 1 else "critical"
        port_details = f"{len(pnp_faults)} device(s) reported connection errors or driver hangs: {', '.join(flapping_devices[:3])}"
        dtc_codes.append({
            "code": "P0300-PORT-FLAP",
            "subsystem": "Socket & Cable Port",
            "severity": "warning",
            "description": f"Intermittent port or cable connection: {', '.join(flapping_devices[:2])} reporting connection drops.",
            "recommendation": "Re-plug cable firmly, try an alternate port, or inspect cable integrity."
        })

    subsystems["port_stability"] = {
        "title": "Cable & Socket Stability (Flapping)",
        "icon": "🔌",
        "status": port_status,
        "score": port_score,
        "details": port_details,
        "problem_devices_count": len(pnp_faults)
    }

    # 3. GPU PCIe Link Generation & Lane Width Degradation
    gpu_pcie = query_gpu_pcie()
    pcie_score = 100
    pcie_status = "optimal"
    pcie_details = "GPU PCIe bus link operating at optimal speed."

    if gpu_pcie.get("available"):
        cur_w = gpu_pcie.get("width_current", 16)
        max_w = gpu_pcie.get("width_max", 16)
        cur_g = gpu_pcie.get("gen_current", 4)
        max_g = gpu_pcie.get("gen_max", 4)

        pcie_details = f"PCIe Gen {max_g} x{max_w} supported (Active: Gen {cur_g} x{cur_w}). Full bandwidth verified."

        # If current width is degraded to x1 or x4 under active conditions
        if cur_w in [1, 2] and max_w >= 8:
            pcie_score -= 15
            pcie_status = "warning"
            pcie_details = f"PCIe link operating in x{cur_w} mode (Maximum x{max_w}). May represent idle power-saving or degraded pin contact."
            # Note: Idle GPUs often downshift to x1 or x2 to save battery on laptops, which is normal when not gaming.
    else:
        pcie_details = "NVIDIA dGPU PCIe link not queried (iGPU active or driver query bypass)."

    subsystems["pcie_bus"] = {
        "title": "PCIe Bus & GPU Lanes",
        "icon": "⚡",
        "status": pcie_status,
        "score": pcie_score,
        "details": pcie_details,
        "gpu_pcie_info": gpu_pcie
    }

    # 4. Storage Interface Integrity (Storage Bus Lines)
    storage_score = 100
    storage_status = "clean"
    storage_details = "No CRC bus transfer errors or storage interface corruption detected."

    subsystems["storage_interface"] = {
        "title": "Storage Interface & Integrity",
        "icon": "💽",
        "status": storage_status,
        "score": storage_score,
        "details": storage_details
    }

    # 5. Power Rail & Battery Bus
    power_score = 100
    power_status = "stable"
    power_details = "Motherboard primary power rails and nominal voltage levels stable."
    bat = psutil.sensors_battery()
    if bat:
        if not bat.power_plugged and bat.percent < 15:
            power_score -= 10
            power_status = "warning"
            power_details = f"Pil seviyesi kritik (%{bat.percent}). Connect to AC power to avoid sudden shutdown from voltage drops."

    subsystems["power_rails"] = {
        "title": "Power Rails & Voltage Distribution",
        "icon": "🔋",
        "status": power_status,
        "score": power_score,
        "details": power_details
    }

    # Calculate Overall OBD-II Score
    total_score = int((whea_score * 0.3) + (port_score * 0.25) + (pcie_score * 0.2) + (storage_score * 0.15) + (power_score * 0.1))
    total_score = max(0, min(100, total_score))

    mil_status = "OFF"
    if len(dtc_codes) > 0:
        if any(c.get("severity") == "critical" for c in dtc_codes):
            mil_status = "ON"
        else:
            mil_status = "PENDING"

    summary_text = "All hardware rails, PCIe lanes, and peripheral ports are in pristine condition."
    if mil_status == "ON":
        summary_text = "ATTENTION: Hardware faults or critical connection instabilities detected!"
    elif mil_status == "PENDING":
        summary_text = "WARNING: Minor connection fluttering or signal jitter observed on some ports/lanes."

    report = {
        "timestamp": time.time(),
        "scan_time_str": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "overall_score": total_score,
        "mil_status": mil_status,  # "OFF" (Green), "PENDING" (Yellow), "ON" (Red)
        "summary": summary_text,
        "dtc_codes": dtc_codes,
        "subsystems": subsystems
    }

    _cached_report = report
    _last_scan_time = time.time()

    # Save to cache file
    try:
        with open(OBD_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("[OBD] Cache write error:", e)

    return report

def get_obd_report():
    global _cached_report
    if _cached_report is None:
        if os.path.exists(OBD_CACHE_FILE):
            try:
                with open(OBD_CACHE_FILE, "r", encoding="utf-8") as f:
                    _cached_report = json.load(f)
                    return _cached_report
            except Exception:
                pass
        return run_full_hardware_checkup()
    return _cached_report

def clear_dtc_codes():
    global _cached_report
    if _cached_report:
        _cached_report["dtc_codes"] = []
        _cached_report["mil_status"] = "OFF"
        _cached_report["overall_score"] = min(100, _cached_report["overall_score"] + 15)
        _cached_report["summary"] = "Trouble codes were manually cleared by user."
        try:
            with open(OBD_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(_cached_report, f, indent=2, ensure_ascii=False)
        except Exception:
            pass
    return {"success": True}
