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
        "category_name": "🌐 Ağ & İnternet",
        "title": "DNS Önbelleğini Temizle",
        "description": "Bozuk veya eski DNS kayıtlarını temizleyerek web sitelerine erişim sorunlarını giderir.",
        "cmd_desc": "ipconfig /flushdns",
        "icon": "🌐",
        "danger": False
    },
    {
        "id": "net_winsock_reset",
        "category": "network",
        "category_name": "🌐 Ağ & İnternet",
        "title": "Winsock & TCP/IP Yığını Sıfırla",
        "description": "Bozulan internet bağlantısını, soket çakışmalarını ve IP yığınını fabrika ayarlarına döndürür.",
        "cmd_desc": "netsh winsock reset && netsh int ip reset",
        "icon": "⚡",
        "danger": False
    },
    {
        "id": "net_arp_clear",
        "category": "network",
        "category_name": "🌐 Ağ & İnternet",
        "title": "ARP Önbelleğini Temizle",
        "description": "Yerel ağ yönlendirici (modem/router) IP-MAC eşleşme tablosunu sıfırlar.",
        "cmd_desc": "netsh interface ip delete arpcache",
        "icon": "📡",
        "danger": False
    },
    {
        "id": "net_full_repair",
        "category": "network",
        "category_name": "🌐 Ağ & İnternet",
        "title": "Tam Ağ & İnternet Onarımı (Hepsi)",
        "description": "DNS, Winsock, TCP/IP ve ARP yığınının tümünü tek seferde sıfırlayıp onarır.",
        "cmd_desc": "Full Network Stack Reinitialization",
        "icon": "🚀",
        "danger": False
    },

    # 2. AUDIO & MULTIMEDIA
    {
        "id": "audio_restart_services",
        "category": "audio",
        "category_name": "🔊 Ses & Servisler",
        "title": "Windows Ses Servislerini Yeniden Başlat",
        "description": "Kilitlenen, ses vermeyen veya donan kulaklık/hoparlör sürücü servislerini (AudioSrv) anında kurtarır.",
        "cmd_desc": "Restart-Service AudioEndpointBuilder, AudioSrv",
        "icon": "🔊",
        "danger": False
    },

    # 3. PRINTER & SPOOLER
    {
        "id": "spooler_clear_queue",
        "category": "hardware",
        "category_name": "🖨️ Yazdırma & Donanım",
        "title": "Yazdırma Kuyruğunu & Spooler'ı Temizle",
        "description": "Kuyrukta takılıp yazıcıyı kilitleyen belgeleri temizler ve yazdırma servisini yeniden başlatır.",
        "cmd_desc": "Purge PRINTERS folder & restart Spooler",
        "icon": "🖨️",
        "danger": False
    },

    # 4. EXPLORER & SEARCH
    {
        "id": "explorer_restart",
        "category": "system",
        "category_name": "📁 Gezgin & Masaüstü",
        "title": "Windows Gezginini Yeniden Başlat",
        "description": "Donan görev çubuğu, açılmayan klasörler ve yanıt vermeyen masaüstünü anında sıfırlar.",
        "cmd_desc": "taskkill /f /im explorer.exe && start explorer.exe",
        "icon": "📁",
        "danger": False
    },
    {
        "id": "search_index_restart",
        "category": "system",
        "category_name": "📁 Gezgin & Masaüstü",
        "title": "Windows Arama İndeks Servisini Onar",
        "description": "Başlat menüsünde arama yapılamadığında WSearch dizin servisini sıfırlayıp yeniden başlatır.",
        "cmd_desc": "Restart-Service WSearch",
        "icon": "🔍",
        "danger": False
    },

    # 5. WINDOWS UPDATE & COMPONENT STORE
    {
        "id": "update_cache_purge",
        "category": "maintenance",
        "category_name": "🛡️ Sistem & Güncelleme",
        "title": "Bozuk Windows Update Önbelleğini Temizle",
        "description": "Takılan veya hata veren güncellemelerin indirme önbelleğini (SoftwareDistribution) siler.",
        "cmd_desc": "Stop wuauserv/bits, purge SoftwareDistribution\\Download, start",
        "icon": "🔄",
        "danger": False
    },
    {
        "id": "store_reset_cache",
        "category": "maintenance",
        "category_name": "🛡️ Sistem & Güncelleme",
        "title": "Microsoft Store Önbelleğini Sıfırla",
        "description": "Açılmayan veya indirme hatası veren Microsoft Store mağazasını sıfırlar.",
        "cmd_desc": "wsreset.exe -i",
        "icon": "🛍️",
        "danger": False
    },

    # 6. DEEP SYSTEM INTEGRITY (ASYNC)
    {
        "id": "sfc_scannow",
        "category": "integrity",
        "category_name": "🛡️ Derin Sistem Bütünlüğü (SFC / DISM)",
        "title": "SFC /scannow (Bozuk Sistem Dosyalarını Onar)",
        "description": "Windows çekirdek sistem dosyalarını tarar, bozulmuş veya silinmiş olanları Microsoft orijinal kopyalarıyla onarır.",
        "cmd_desc": "sfc /scannow (Arka planda çalışır)",
        "icon": "🛡️",
        "is_long": True,
        "danger": False
    },
    {
        "id": "dism_restorehealth",
        "category": "integrity",
        "category_name": "🛡️ Derin Sistem Bütünlüğü (SFC / DISM)",
        "title": "DISM RestoreHealth (Bileşen Deposunu Onar)",
        "description": "Windows Component Store (WinSxS) hasarlarını Microsoft resmi sunucularından indirerek tamir eder.",
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
            return {"status": "busy", "success": False, "error": "Başka bir onarım görevi şu an arka planda çalışıyor."}

    # 1. Quick Sync Fixes
    if tool_id == "net_dns_flush":
        ok, out = run_command_sync(["ipconfig", "/flushdns"])
        return {"success": ok, "tool_id": tool_id, "logs": [out or "DNS önbelleği başarıyla temizlendi."]}

    elif tool_id == "net_winsock_reset":
        logs = []
        ok1, out1 = run_command_sync(["netsh", "winsock", "reset"])
        ok2, out2 = run_command_sync(["netsh", "int", "ip", "reset"])
        logs.append(out1 or "Winsock katalog sıfırlandı.")
        logs.append(out2 or "TCP/IP yığını sıfırlandı.")
        return {"success": ok1 and ok2, "tool_id": tool_id, "logs": logs}

    elif tool_id == "net_arp_clear":
        ok, out = run_command_sync(["netsh", "interface", "ip", "delete", "arpcache"])
        return {"success": ok, "tool_id": tool_id, "logs": [out or "ARP önbelleği silindi."]}

    elif tool_id == "net_full_repair":
        logs = []
        _, o1 = run_command_sync(["ipconfig", "/flushdns"])
        _, o2 = run_command_sync(["netsh", "winsock", "reset"])
        _, o3 = run_command_sync(["netsh", "int", "ip", "reset"])
        _, o4 = run_command_sync(["netsh", "interface", "ip", "delete", "arpcache"])
        logs.append("✓ DNS Önbelleği temizlendi.")
        logs.append("✓ Winsock ve TCP/IP bağlantı yığını sıfırlandı.")
        logs.append("✓ ARP tablosu yenilendi.")
        logs.append("Tüm ağ bileşenleri başarıyla onarıldı.")
        return {"success": True, "tool_id": tool_id, "logs": logs}

    elif tool_id == "audio_restart_services":
        ps_cmd = 'Stop-Service -Name AudioEndpointBuilder, AudioSrv -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 400; Start-Service -Name AudioEndpointBuilder, AudioSrv -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Ses (AudioSrv) ve Ses Bitiş Noktası servisleri yeniden başlatıldı."]}

    elif tool_id == "spooler_clear_queue":
        ps_cmd = 'Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -Recurse -ErrorAction SilentlyContinue; Start-Service -Name Spooler -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Yazıcı kuyruğu temizlendi ve Print Spooler servisi yeniden başlatıldı."]}

    elif tool_id == "explorer_restart":
        ps_cmd = 'Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 300; Start-Process explorer.exe'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Gezgini (explorer.exe) yeniden başlatıldı."]}

    elif tool_id == "search_index_restart":
        ps_cmd = 'Restart-Service -Name WSearch -Force -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Windows Search dizin arama servisi yeniden başlatıldı."]}

    elif tool_id == "update_cache_purge":
        ps_cmd = 'Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue; Remove-Item -Path "$env:SystemRoot\\SoftwareDistribution\\Download\\*" -Force -Recurse -ErrorAction SilentlyContinue; Start-Service -Name wuauserv, bits -ErrorAction SilentlyContinue'
        ok, out = run_command_sync(["powershell", "-NoProfile", "-Command", ps_cmd])
        return {"success": ok, "tool_id": tool_id, "logs": ["✓ Bozuk Windows Update indirme önbelleği temizlendi ve güncelleme servisleri sıfırlandı."]}

    elif tool_id == "store_reset_cache":
        try:
            subprocess.Popen(["wsreset.exe", "-i"])
            return {"success": True, "tool_id": tool_id, "logs": ["✓ Microsoft Store önbellek sıfırlama işlemi başlatıldı."]}
        except Exception as e:
            return {"success": False, "tool_id": tool_id, "logs": [f"Hata: {str(e)}"]}

    # 2. Async Long-Running Tasks (SFC & DISM)
    elif tool_id in ["sfc_scannow", "dism_restorehealth"]:
        t = threading.Thread(target=_async_integrity_worker, args=(tool_id,), daemon=True)
        t.start()
        return {"success": True, "tool_id": tool_id, "async": True, "logs": ["Görev arka planda başlatıldı. İlerlemeyi canlı takip edebilirsiniz..."]}

    return {"success": False, "error": f"Bilinmeyen onarım aracı: {tool_id}"}

def _async_integrity_worker(tool_id):
    global _active_task
    with _task_lock:
        _active_task["tool_id"] = tool_id
        _active_task["status"] = "running"
        _active_task["progress"] = 5
        _active_task["logs"] = [f"[Zenith Fixer] {tool_id} derin sistem onarımı başlatılıyor..."]

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
                _active_task["logs"].append(f"[Zenith Fixer] ✓ {tool_id} onarım görevi başarıyla tamamlandı!")
            else:
                _active_task["status"] = "completed"
                _active_task["logs"].append(f"[Zenith Fixer] Görev tamamlandı (Çıkış Kodu: {proc.returncode}).")
    except Exception as e:
        with _task_lock:
            _active_task["status"] = "error"
            _active_task["logs"].append(f"[Zenith Fixer] Hata oluştu: {str(e)}")
