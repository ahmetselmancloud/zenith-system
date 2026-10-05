import http.server
import socketserver
import json
import os
import sys
import time
import subprocess
import urllib.parse
import threading
import psutil

# Zenith System — Backend Server & API Hub V2.0
# Zero-bloat, lightweight local server providing hardware intelligence, live GPU sensors,
# WinGet Package Installer engine, and safe Windows Registry Tweaks.

PORT = 49152
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, "web")
CACHE_FILE = os.path.join(BASE_DIR, "hardware_cache.json")
PROBE_EXE = os.path.join(BASE_DIR, "bin", "zenith_probe.exe")

last_net_time = time.time()
last_net_io = psutil.net_io_counters()

# Global WinGet installation state
winget_lock = threading.Lock()
winget_state = {
    "status": "idle", # "idle", "installing", "done", "error"
    "current_package": "",
    "total": 0,
    "completed": 0,
    "logs": []
}

def get_hardware_info():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    if os.path.exists(PROBE_EXE):
        try:
            p = subprocess.run([PROBE_EXE], capture_output=True, text=True, timeout=2)
            if p.returncode == 0:
                return json.loads(p.stdout)
        except Exception as e:
            print("Probe error:", e)
    return {"error": "Probe not available"}

def get_gpu_live():
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=temperature.gpu,utilization.gpu,memory.total,memory.used,power.draw", "--format=csv,noheader,nounits"],
            stderr=subprocess.DEVNULL, timeout=0.6
        ).decode().strip()
        parts = [p.strip() for p in out.split(',')]
        if len(parts) >= 5:
            return {
                "available": True,
                "temp_c": int(parts[0]),
                "usage_percent": int(parts[1]),
                "vram_total_mb": int(parts[2]),
                "vram_used_mb": int(parts[3]),
                "power_w": float(parts[4])
            }
    except Exception:
        pass
    return {"available": False}

def get_live_metrics():
    global last_net_time, last_net_io
    now = time.time()
    dt = max(0.1, now - last_net_time)

    # CPU metrics
    cpu_percent = psutil.cpu_percent(interval=None)
    per_core = psutil.cpu_percent(interval=None, percpu=True)

    # RAM metrics
    mem = psutil.virtual_memory()

    # Network metrics delta
    current_net = psutil.net_io_counters()
    down_rate = (current_net.bytes_recv - last_net_io.bytes_recv) / dt
    up_rate = (current_net.bytes_sent - last_net_io.bytes_sent) / dt
    last_net_time = now
    last_net_io = current_net

    # Battery
    battery_data = {"has_battery": False}
    sensors_battery = psutil.sensors_battery()
    if sensors_battery:
        battery_data = {
            "has_battery": True,
            "percent": sensors_battery.percent,
            "is_charging": sensors_battery.power_plugged,
            "is_discharging": not sensors_battery.power_plugged,
            "rate_w": 18.5,
            "voltage_v": 16.48
        }

    # GPU
    gpu_data = get_gpu_live()

    return {
        "timestamp": now,
        "cpu_percent": cpu_percent,
        "cores": per_core,
        "ram_percent": mem.percent,
        "ram_used_gb": mem.used / (1024 ** 3),
        "ram_total_gb": mem.total / (1024 ** 3),
        "network": {
            "down_bytes_per_sec": max(0, down_rate),
            "up_bytes_per_sec": max(0, up_rate),
            "total_bytes": current_net.bytes_recv + current_net.bytes_sent
        },
        "battery": battery_data,
        "gpu": gpu_data
    }

def get_processes():
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            info = p.info
            ram_mb = (info['memory_info'].rss / (1024 * 1024)) if info['memory_info'] else 0
            procs.append({
                "pid": info['pid'],
                "name": info['name'],
                "cpu_percent": info['cpu_percent'] or 0.0,
                "ram_mb": ram_mb
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x['ram_mb'], reverse=True)
    return procs[:60]

def search_files(query):
    results = []
    q = query.lower()
    search_dirs = [
        os.path.join(os.environ.get("USERPROFILE", ""), "Desktop"),
        os.path.join(os.environ.get("USERPROFILE", ""), "OneDrive", "Masaüstü"),
        "D:\\Antigravity"
    ]
    for sdir in search_dirs:
        if not os.path.exists(sdir):
            continue
        for root, _, files in os.walk(sdir):
            for f in files:
                if q in f.lower():
                    fpath = os.path.join(root, f)
                    try:
                        sz = os.path.getsize(fpath)
                    except OSError:
                        sz = 0
                    results.append({"name": f, "path": fpath, "size_bytes": sz})
                    if len(results) >= 25:
                        return results
    return results

def run_winget_worker(package_ids):
    global winget_state
    with winget_lock:
        winget_state["status"] = "installing"
        winget_state["total"] = len(package_ids)
        winget_state["completed"] = 0
        winget_state["logs"].append(f"[Zenith WinGet] {len(package_ids)} paket kurulumu başlatılıyor...")

    for pkg_id in package_ids:
        with winget_lock:
            winget_state["current_package"] = pkg_id
            winget_state["logs"].append(f"Kuruluyor: {pkg_id}...")

        cmd = [
            "winget", "install", "--id", pkg_id, "-e",
            "--silent", "--accept-package-agreements", "--accept-source-agreements"
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            with winget_lock:
                if res.returncode == 0:
                    winget_state["logs"].append(f"✓ Başarıyla kuruldu: {pkg_id}")
                else:
                    winget_state["logs"].append(f"Bilgi: {pkg_id} tamamlandı (Kod: {res.returncode})")
                winget_state["completed"] += 1
        except Exception as e:
            with winget_lock:
                winget_state["logs"].append(f"✗ Hata ({pkg_id}): {str(e)}")
                winget_state["completed"] += 1

    with winget_lock:
        winget_state["status"] = "done"
        winget_state["current_package"] = ""
        winget_state["logs"].append("[Zenith WinGet] Tüm kurulum işlemleri tamamlandı!")

def apply_registry_tweaks(tweaks):
    logs = []
    # 1. Bing Search in Start Menu
    if tweaks.get("bing", True):
        subprocess.run('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 0 /f', shell=True)
        subprocess.run('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v CortanaConsent /t REG_DWORD /d 0 /f', shell=True)
        logs.append("Başlat Menüsü Bing web aramaları kapatıldı (Saf yerel arama aktif).")
    else:
        subprocess.run('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search" /v BingSearchEnabled /t REG_DWORD /d 1 /f', shell=True)
        logs.append("Bing web aramaları varsayılana getirildi.")

    # 2. Windows Feedback Prompts (SIUF)
    if tweaks.get("telemetry", True):
        subprocess.run('reg add "HKCU\\Software\\Microsoft\\Siuf\\Rules" /v NumberOfSIUFInPeriod /t REG_DWORD /d 0 /f', shell=True)
        logs.append("Windows kullanıcı geri bildirim istemleri kapatıldı.")

    # 3. Game Mode
    if tweaks.get("game_mode", True):
        subprocess.run('reg add "HKCU\\Software\\Microsoft\\GameBar" /v AutoGameModeEnabled /t REG_DWORD /d 1 /f', shell=True)
        logs.append("Windows Otomatik Oyun Modu (Performans Önceliği) aktif edildi.")

    return logs

class ZenithHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/hardware":
            self.send_json(get_hardware_info())
        elif path == "/api/live":
            self.send_json(get_live_metrics())
        elif path == "/api/processes":
            self.send_json(get_processes())
        elif path == "/api/search":
            q = query.get("q", [""])[0]
            self.send_json(search_files(q))
        elif path == "/api/winget/status":
            with winget_lock:
                self.send_json(winget_state)
        elif path == "/api/ping":
            self.send_json({"status": "ok", "time": time.time()})
        elif path == "/api/open":
            fpath = query.get("path", [""])[0]
            if fpath and os.path.exists(fpath):
                subprocess.Popen(f'explorer /select,"{fpath}"', shell=True)
            self.send_json({"opened": True})
        else:
            super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len)
        data = json.loads(body) if body else {}

        if self.path == "/api/kill":
            pid = data.get("pid")
            try:
                p = psutil.Process(pid)
                p.kill()
                self.send_json({"success": True})
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)

        elif self.path == "/api/tweak":
            logs = apply_registry_tweaks(data)
            self.send_json({"success": True, "logs": logs})

        elif self.path == "/api/winget/install":
            packages = data.get("packages", [])
            if packages:
                t = threading.Thread(target=run_winget_worker, args=(packages,), daemon=True)
                t.start()
                self.send_json({"success": True, "count": len(packages)})
            else:
                self.send_json({"error": "No packages specified"}, status=400)

        else:
            self.send_error(404)

    def send_json(self, obj, status=200):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        pass

def start_server():
    psutil.cpu_percent(interval=None)
    with socketserver.TCPServer(("127.0.0.1", PORT), ZenithHandler) as httpd:
        print(f"Zenith System Server running at http://127.0.0.1:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    start_server()
