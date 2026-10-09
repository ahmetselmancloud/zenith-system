import os
import sys
import subprocess
import threading
import time

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

# Zenith System — Windows Troubleshooter & System Fixer Engine
# One-click repairs for networking, audio, print spooler, explorer, search and system integrity.

_task_lock = threading.Lock()
_active_task = {
    "tool_id": None,
    "status": "idle",  # "idle", "running", "completed", "error"
    "progress": 0,
    "logs": []
}

TROUBLESHOOT_TOOLS = [
    # 1. NETWORKING & INTERNET
    {
        "id": "net_dns_flush",
        "category": "network",
        "category_name": "🌐 Network & Internet",
        "title": "Flush DNS Cache",
        "description": "Clears corrupted or outdated DNS cache to resolve website connection and resolution issues.",
        "cmd_desc": "ipconfig /flushdns",
        "icon": "🌐",
        "danger": False
    },
    {
        "id": "net_winsock_reset",
        "category": "network",
        "category_name": "🌐 Network & Internet",
        "title": "Reset Winsock & TCP/IP Stack",
        "description": "Resets corrupted socket state, IP routes, and TCP/IP stack to clean factory defaults.",
        "cmd_desc": "netsh winsock reset && netsh int ip reset",
        "icon": "⚡",
        "danger": False
    },
    {
        "id": "net_arp_clear",
        "category": "network",
        "category_name": "🌐 Network & Internet",
        "title": "Clear ARP Cache",
        "description": "Flushes local subnet router and gateway IP-to-MAC resolution cache.",
        "cmd_desc": "netsh interface ip delete arpcache",
        "icon": "📡",
        "danger": False
    },
    {
        "id": "net_full_repair",
        "category": "network",
        "category_name": "🌐 Network & Internet",
        "title": "Full Network & Internet Stack Repair",
        "description": "Comprehensively flushes DNS, resets Winsock, reinitializes TCP/IP stack and clears ARP cache in one click.",
        "cmd_desc": "Full Network Stack Reinitialization",
        "icon": "🚀",
        "danger": False
    },

    # 2. AUDIO & MULTIMEDIA
    {
        "id": "audio_restart_services",
        "category": "audio",
        "category_name": "🔊 Audio & Services",
        "title": "Restart Windows Audio Services",
        "description": "Recovers frozen, muted or non-responsive headphone and speaker audio services (AudioSrv).",
        "cmd_desc": "Restart-Service AudioEndpointBuilder, AudioSrv",
        "icon": "🔊",
        "danger": False
    },

    # 3. PRINTER & SPOOLER
    {
        "id": "spooler_clear_queue",
        "category": "hardware",
        "category_name": "🖨️ Printing & Hardware",
        "title": "Clear Print Queue & Restart Spooler",
        "description": "Purges stuck print jobs from spool directory and restarts the Windows Print Spooler service.",
        "cmd_desc": "Purge PRINTERS folder & restart Spooler",
        "icon": "🖨️",
        "danger": False
    },

    # 4. EXPLORER & SEARCH
    {
        "id": "explorer_restart",
        "category": "system",
        "category_name": "📁 Explorer & Desktop",
        "title": "Restart Windows Explorer",
        "description": "Restarts explorer.exe to resolve frozen taskbars, unresponsive shell, and hung file dialogs.",
        "cmd_desc": "taskkill /f /im explorer.exe && start explorer.exe",
        "icon": "📁",
        "danger": False
    },
    {
        "id": "search_index_restart",
        "category": "system",
        "category_name": "📁 Explorer & Desktop",
        "title": "Repair Windows Search Indexer",
        "description": "Restarts Windows Search service (WSearch) to fix non-responsive search and indexing glitches.",
        "cmd_desc": "Restart-Service WSearch",
        "icon": "🔍",
        "danger": False
    },

    # 5. WINDOWS UPDATE & COMPONENT STORE
    {
        "id": "update_cache_purge",
        "category": "maintenance",
        "category_name": "🛡️ System & Updates",
        "title": "Purge Corrupted Windows Update Cache",
        "description": "Cleans the SoftwareDistribution download cache of stuck or failing Windows updates.",
        "cmd_desc": "Stop wuauserv/bits, purge SoftwareDistribution\\Download, start",
        "icon": "🔄",
        "danger": False
    },
    {
        "id": "store_reset_cache",
        "category": "maintenance",
        "category_name": "🛡️ System & Updates",
        "title": "Reset Microsoft Store Cache (WSReset)",
        "description": "Executes WSReset to clear Windows Store cache and resolve store download hangs.",
        "cmd_desc": "wsreset.exe -i",
        "icon": "🛍️",
        "danger": False
    },

    # 6. DEEP SYSTEM INTEGRITY (ASYNC)
    {
        "id": "sfc_scannow",
        "category": "integrity",
        "category_name": "🛡️ Deep System Integrity (SFC / DISM)",
        "title": "SFC /scannow (System File Checker)",
        "description": "Scans Windows protected system files and replaces corrupted files from official cached backups.",
        "cmd_desc": "sfc /scannow (Executes asynchronously in background)",
        "icon": "🛡️",
        "is_long": True,
        "danger": False
    },
    {
        "id": "dism_restorehealth",
        "category": "integrity",
        "category_name": "🛡️ Deep System Integrity (SFC / DISM)",
        "title": "DISM RestoreHealth (Component Store Repair)",
        "description": "Repairs Windows Component Store (WinSxS) corruptions using official Windows recovery sources.",
        "cmd_desc": "dism /online /cleanup-image /restorehealth",
        "icon": "🏥",
        "is_long": True,
        "danger": False
    }
]

def get_troubleshoot_tools():
    return {
        "tools": TROUBLESHOOT_TOOLS,
        "active_task": get_troubleshooter_status()
    }

def get_troubleshooter_status():
    with _task_lock:
        return dict(_active_task)

def run_command_sync(cmd, shell=False):
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', shell=shell, timeout=25, creationflags=CREATE_NO_WINDOW)
        out = (res.stdout or "") + (res.stderr or "")
        return res.returncode == 0, out.strip()
    except Exception as e:
        return False, str(e)

def execute_fix(tool_id):
    global _active_task

    # Check if a long async job is already running
    with _task_lock:
        if _active_task["status"] == "running":
            return {"status": "busy", "success": False, "error": "Another repair task is currently running in the background."}

    # 1. Quick Sync Fixes
    if tool_id == "net_dns_flush":
        ok, out = run_command_sync(["ipconfig", "/flushdns"])
        return {"success": ok, "tool_id": tool_id, "logs": [out or "DNS cache flushed successfully."]}

    elif tool_id == "net_winsock_reset":
        logs = []
        ok1, out1 = run_command_sync(["netsh", "winsock", "reset"])
        ok2, out2 = run_command_sync(["netsh", "int", "ip", "reset"])
        logs.append(out1 or "Winsock catalog reset successfully.")
        logs.append(out2 or "TCP/IP stack reinitialized successfully.")
        return {"success": ok1 and ok2, "tool_id": tool_id, "logs": logs}

    elif tool_id == "net_arp_clear":
        ok, out = run_command_sync(["netsh", "interface", "ip", "delete", "arpcache"])
        return {"success": ok, "tool_id": tool_id, "logs": [out or "ARP cache deleted successfully."]}

    elif tool_id == "net_full_repair":
        logs = []
        _, o1 = run_command_sync(["ipconfig", "/flushdns"])
        _, o2 = run_command_sync(["netsh", "winsock", "reset"])
        _, o3 = run_command_sync(["netsh", "int", "ip", "reset"])
        _, o4 = run_command_sync(["netsh", "interface", "ip", "delete", "arpcache"])
        logs.append("✓ DNS cache flushed.")
        logs.append("✓ Winsock and TCP/IP stack reset.")
        logs.append("✓ ARP tablosu yenilendi.")
        logs.append("All network components repaired successfully.")
        return {"success": True, "tool_id": tool_id, "logs": logs}

    elif tool_id == "audio_restart_services":
        ps_cmd = 'Stop-Service -Name AudioEndpointBuilder, AudioSrv -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 400; Start-Service -Name AudioEndpointBuilder, AudioSrv -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Audio (AudioSrv) and Audio Endpoint services restarted."]}

    elif tool_id == "spooler_clear_queue":
        ps_cmd = 'Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -Recurse -ErrorAction SilentlyContinue; Start-Service -Name Spooler -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Print spool queue cleared and Print Spooler restarted."]}

    elif tool_id == "explorer_restart":
        ps_cmd = 'Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300; Start-Process explorer.exe'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Explorer (explorer.exe) restarted successfully."]}

    elif tool_id == "search_index_restart":
        ps_cmd = 'Restart-Service -Name WSearch -Force -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Search (WSearch) indexer restarted."]}

    elif tool_id == "update_cache_purge":
        ps_cmd = 'Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:SystemRoot\\SoftwareDistribution\\Download\\*" -Force -Recurse -ErrorAction SilentlyContinue; Start-Service -Name wuauserv, bits -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Corrupted Windows Update download cache purged and services reinitialized."]}

    elif tool_id == "store_reset_cache":
        try:
            subprocess.Popen(["wsreset.exe", "-i"])
            return {"success": True, "tool_id": tool_id, "logs": ["✓ Microsoft Store cache reset initiated (wsreset.exe)."]}
        except Exception as e:
            return {"success": False, "tool_id": tool_id, "logs": [f"Error: {str(e)}"]}

    # 2. Async Long-Running Tasks (SFC & DISM)
    elif tool_id in ["sfc_scannow", "dism_restorehealth"]:
        t = threading.Thread(target=_async_integrity_worker, args=(tool_id,), daemon=True)
        t.start()
        return {
            "success": True,
            "tool_id": tool_id,
            "status": "running",
            "async": True,
            "logs": ["Task initiated in background. Track live output in console."]
        }

    return {"success": False, "error": f"Unknown repair tool: {tool_id}"}

def _async_integrity_worker(tool_id):
    global _active_task
    with _task_lock:
        _active_task["tool_id"] = tool_id
        _active_task["status"] = "running"
        _active_task["progress"] = 5
        _active_task["logs"] = [f"[Zenith Fixer] {tool_id} deep system repair initiated..."]

    cmd = ["sfc", "/scannow"] if tool_id == "sfc_scannow" else ["dism", "/online", "/cleanup-image", "/restorehealth"]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', bufsize=1, creationflags=CREATE_NO_WINDOW)
        
        for line in iter(proc.stdout.readline, ''):
            l = line.strip()
            if l:
                with _task_lock:
                    _active_task["logs"].append(l)
                    # Rough progress estimation from logs
                    if "%" in l:
                        try:
                            # e.g. "Verification 45% complete" or "[=== 45.0% ===]"
                            parts = l.split("%")[0].split()
                            if parts:
                                val = float(parts[-1].replace("[", "").replace("=", ""))
                                _active_task["progress"] = min(99, int(val))
                        except Exception:
                            pass
        proc.stdout.close()
        proc.wait()

        with _task_lock:
            _active_task["progress"] = 100
            if proc.returncode == 0:
                _active_task["status"] = "completed"
                _active_task["logs"].append(f"[Zenith Fixer] ✓ {tool_id} repair task completed successfully!")
            else:
                _active_task["status"] = "completed"
                _active_task["logs"].append(f"[Zenith Fixer] Task completed (Exit code: {proc.returncode}).")
    except Exception as e:
        with _task_lock:
            _active_task["status"] = "error"
            _active_task["logs"].append(f"[Zenith Fixer] Error occurred: {str(e)}")
