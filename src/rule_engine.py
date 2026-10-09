import os
import sys
import json
import time
import datetime
import threading
import subprocess
import re
import ctypes
from ctypes import wintypes
import psutil

# Zenith System — Intelligent Rule & Event Automation Engine (Faz 3)
# IF/THEN automation for laptops: Dynamic Gaming profiles, Thermal Guard, Battery Saver, and Night Quiet modes.

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES_CONFIG_FILE = os.path.join(BASE_DIR, "rules_config.json")

user32 = ctypes.windll.user32

DEFAULT_GAME_PROCESSES = [
    "Cyberpunk2077.exe", "cs2.exe", "csgo.exe", "Valorant.exe", "VALORANT-Win64-Shipping.exe",
    "FortniteClient-Win64-Shipping.exe", "GTA5.exe", "RDR2.exe", "Overwatch.exe",
    "League of Legends.exe", "LeagueClient.exe", "Dota2.exe", "APEX.exe", "r5apex.exe",
    "RainbowSix.exe", "ModernWarfare.exe", "cod.exe", "Minecraft.Windows.exe", "javaw.exe",
    "Starfield.exe", "Witcher3.exe", "BaldursGate3.exe", "bg3.exe", "EldenRing.exe",
    "Destiny2.exe", "RustClient.exe", "PUBG.exe", "TslGame.exe", "GenshinImpact.exe",
    "HonkaiStarRail.exe", "RocketLeague.exe", "ForzaHorizon5.exe", "HellDivers2.exe",
    "FlightSimulator.exe", "NeedForSpeed.exe", "FIFA23.exe", "FC24.exe", "FC25.exe",
    "Blender.exe", "3dsmax.exe", "maya.exe", "Cinema 4D.exe", "UnrealEditor.exe", "Unity.exe"
]

DEFAULT_RULES = [
    {
        "id": "preset_game_mode",
        "name": "🎮 Akıllı Oyun & 3D Modu",
        "description": "Oyun veya 3D yazılım açıldığında Fanı Turbo'ya al, Yüksek Performans güç planına geç, Win tuşunu kilitle. Oyundan çıkınca eski ayarlara dön.",
        "icon": "🎮",
        "enabled": False,
        "is_preset": True,
        "auto_revert": True,
        "cooldown_sec": 5,
        "trigger": {
            "type": "foreground_game",
            "process_list": DEFAULT_GAME_PROCESSES
        },
        "actions": [
            {"type": "set_fan_profile", "param": "turbo", "label": "Fan Profilini 'Turbo' Yap"},
            {"type": "set_power_plan", "param": "high_performance", "label": "Yüksek Performans Güç Planına Geç"},
            {"type": "set_winkey", "param": "locked", "label": "Windows Tuşunu Kilitle"}
        ],
        "state": {
            "is_active": False,
            "last_evaluated": 0,
            "saved_state": {}
        }
    },
    {
        "id": "preset_thermal_guard",
        "name": "🔥 Termal Koruma & Aşırı Isınma Kalkanı",
        "description": "GPU sıcaklığı 82°C'yi aşarsa anında Cooler Boost / Turbo fana geç ve masaüstü uyarısı gönder. 74°C altına inince normale dön.",
        "icon": "🔥",
        "enabled": False,
        "is_preset": True,
        "auto_revert": True,
        "cooldown_sec": 15,
        "trigger": {
            "type": "gpu_temp_gte",
            "threshold": 82,
            "hysteresis": 74
        },
        "actions": [
            {"type": "set_fan_profile", "param": "cooler_boost", "label": "Fanı 'Cooler Boost' (Maksimum) Moduna Al"},
            {"type": "notify", "param": "⚠️ GPU 82°C sıcaklığı aştı! Fanlar maksimum soğutmaya alındı.", "label": "Masaüstü Uyarısı Gönder"}
        ],
        "state": {
            "is_active": False,
            "last_evaluated": 0,
            "saved_state": {}
        }
    },
    {
        "id": "preset_battery_saver",
        "name": "🔋 Akıllı Pil Koruyucu",
        "description": "Laptop prizden çıkarıldığında ve pil <%25 seviyesine indiğinde Güç Tasarrufu planına geç ve fanı Sessiz moda al.",
        "icon": "🔋",
        "enabled": False,
        "is_preset": True,
        "auto_revert": True,
        "cooldown_sec": 30,
        "trigger": {
            "type": "battery_lte",
            "threshold": 25,
            "require_discharging": True
        },
        "actions": [
            {"type": "set_power_plan", "param": "power_saver", "label": "Güç Tasarrufu Planına Geç"},
            {"type": "set_fan_profile", "param": "silent", "label": "Fan Profilini 'Sessiz' Yap"},
            {"type": "notify", "param": "🔋 Pil kritik seviyede (%25). Güç Tasarrufu modu devreye alındı.", "label": "Bildirim Gönder"}
        ],
        "state": {
            "is_active": False,
            "last_evaluated": 0,
            "saved_state": {}
        }
    },
    {
        "id": "preset_night_quiet",
        "name": "🌙 Gece Sessiz Modu",
        "description": "Gece 23:00 ile 08:00 saatleri arasında fan profilini Sessiz moda alarak sessiz bir çalışma ortamı sağlar.",
        "icon": "🌙",
        "enabled": False,
        "is_preset": True,
        "auto_revert": True,
        "cooldown_sec": 60,
        "trigger": {
            "type": "time_range",
            "start_hour": 23,
            "end_hour": 8
        },
        "actions": [
            {"type": "set_fan_profile", "param": "silent", "label": "Fan Profilini 'Sessiz' Yap"}
        ],
        "state": {
            "is_active": False,
            "last_evaluated": 0,
            "saved_state": {}
        }
    }
]

_engine_lock = threading.Lock()
_engine_data = {
    "enabled": True,
    "last_check_timestamp": 0,
    "rules": [],
    "history": []
}

_server_callbacks = {
    "get_gpu_live": None,
    "get_laptop_state": None,
    "set_fan_profile": None,
    "set_winkey": None,
    "get_power_plans": None,
    "set_power_plan": None
}

def register_callbacks(**kwargs):
    with _engine_lock:
        for k, v in kwargs.items():
            if k in _server_callbacks:
                _server_callbacks[k] = v

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

_last_valid_proc_name = ""

IGNORED_FOCUS_PROCESSES = {
    "cmd.exe", "conhost.exe", "powershell.exe", "python.exe", "zenith.exe", "zenith_probe.exe",
    "searchapp.exe", "shellexperiencehost.exe", "startmenuexperiencehost.exe", "taskhostw.exe",
    "textinputhost.exe", "lockapp.exe", "applicationframehost.exe"
}

def get_active_process_name():
    global _last_valid_proc_name
    try:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return _last_valid_proc_name
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value > 0:
            name = psutil.Process(pid.value).name()
            if name.lower() in IGNORED_FOCUS_PROCESSES:
                return _last_valid_proc_name
            _last_valid_proc_name = name
            return name
    except Exception:
        pass
    return _last_valid_proc_name

def send_windows_notification(title, message):
    try:
        clean_title = re.sub(r'["\']', '', title)
        clean_msg = re.sub(r'["\']', '', message)
        ps_cmd = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $texts = $template.GetElementsByTagName("text")
        $texts.Item(0).AppendChild($template.CreateTextNode('{clean_title}')) > $null
        $texts.Item(1).AppendChild($template.CreateTextNode('{clean_msg}')) > $null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Zenith System")
        $notifier.Show($toast)
        """
        flags = CREATE_NO_WINDOW if sys.platform == "win32" else 0
        subprocess.Popen(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags
        )
    except Exception:
        pass

def load_rules():
    global _engine_data
    with _engine_lock:
        if os.path.exists(RULES_CONFIG_FILE):
            try:
                with open(RULES_CONFIG_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    _engine_data["enabled"] = saved.get("enabled", True)
                    _engine_data["history"] = saved.get("history", [])[:50]
                    saved_rules = saved.get("rules", [])
                    # Merge presets if new presets exist
                    existing_ids = {r["id"] for r in saved_rules}
                    for default_r in DEFAULT_RULES:
                        if default_r["id"] not in existing_ids:
                            saved_rules.append(dict(default_r))
                    _engine_data["rules"] = saved_rules
                    return
            except Exception as e:
                print(f"[RuleEngine] Error loading rules_config.json: {e}")
        
        # Fresh initialization
        _engine_data["enabled"] = True
        _engine_data["rules"] = [dict(r) for r in DEFAULT_RULES]
        _engine_data["history"] = []
        save_rules_unlocked()

def save_rules_unlocked():
    try:
        data_to_save = {
            "enabled": _engine_data["enabled"],
            "rules": _engine_data["rules"],
            "history": _engine_data["history"][:50]
        }
        with open(RULES_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data_to_save, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[RuleEngine] Error saving rules: {e}")

def save_rules():
    with _engine_lock:
        save_rules_unlocked()

def append_history(rule_name, event_type, message):
    entry = {
        "timestamp": time.time(),
        "time_str": datetime.datetime.now().strftime("%H:%M:%S"),
        "rule_name": rule_name,
        "event_type": event_type,  # "trigger", "revert", "error"
        "message": message
    }
    with _engine_lock:
        _engine_data["history"].insert(0, entry)
        if len(_engine_data["history"]) > 60:
            _engine_data["history"] = _engine_data["history"][:60]
    save_rules()

def execute_action(action, rule_name):
    act_type = action.get("type")
    param = action.get("param")

    if act_type == "set_fan_profile":
        cb = _server_callbacks.get("set_fan_profile")
        if cb and callable(cb):
            cb(param)

    elif act_type == "set_power_plan":
        cb_plans = _server_callbacks.get("get_power_plans")
        cb_set = _server_callbacks.get("set_power_plan")
        if cb_plans and cb_set:
            plans_res = cb_plans()
            plans = plans_res.get("plans", [])
            target_guid = None
            if param == "high_performance":
                for p in plans:
                    if any(x in p["name"].lower() for x in ["high performance", "yüksek", "nihai", "ultimate"]):
                        target_guid = p["guid"]
                        break
            elif param == "power_saver":
                for p in plans:
                    if any(x in p["name"].lower() for x in ["saver", "tasarruf", "eco"]):
                        target_guid = p["guid"]
                        break
            elif param == "balanced":
                for p in plans:
                    if any(x in p["name"].lower() for x in ["balanced", "dengeli"]):
                        target_guid = p["guid"]
                        break
            if target_guid:
                cb_set(target_guid)

    elif act_type == "set_winkey":
        cb = _server_callbacks.get("set_winkey")
        if cb and callable(cb):
            cb(param == "locked")

    elif act_type == "notify":
        send_windows_notification("⚡ Zenith Otomasyon", param)

def capture_current_system_state():
    state = {}
    cb_laptop = _server_callbacks.get("get_laptop_state")
    if cb_laptop and callable(cb_laptop):
        ls = cb_laptop()
        state["fan_profile"] = ls.get("fan_profile", "auto")
        state["winkey_locked"] = ls.get("winkey_locked", False)
    
    cb_plans = _server_callbacks.get("get_power_plans")
    if cb_plans and callable(cb_plans):
        plans_res = cb_plans()
        state["power_plan_guid"] = plans_res.get("active_guid", "")
    
    return state

def revert_rule_actions(rule):
    saved = rule.get("state", {}).get("saved_state", {})
    if not saved:
        return

    rule_name = rule.get("name", "Kural")
    revert_msgs = []

    if "fan_profile" in saved:
        cb = _server_callbacks.get("set_fan_profile")
        if cb:
            cb(saved["fan_profile"])
            revert_msgs.append(f"Fan: {saved['fan_profile']}")

    if "winkey_locked" in saved:
        cb = _server_callbacks.get("set_winkey")
        if cb:
            cb(saved["winkey_locked"])
            revert_msgs.append(f"WinKey: {'Kilitli' if saved['winkey_locked'] else 'Açık'}")

    if "power_plan_guid" in saved and saved["power_plan_guid"]:
        cb = _server_callbacks.get("set_power_plan")
        if cb:
            cb(saved["power_plan_guid"])
            revert_msgs.append("Güç Planı eski haline alındı")

    append_history(rule_name, "revert", f"Önceki sistem ayarlarına dönüldü ({', '.join(revert_msgs) or 'Varsayılan'})")

def evaluate_single_rule(rule, telemetry):
    trigger = rule.get("trigger", {})
    t_type = trigger.get("type")
    is_active = rule.get("state", {}).get("is_active", False)

    if t_type == "foreground_game":
        active_proc = telemetry.get("active_proc", "").lower()
        proc_list = [p.lower() for p in trigger.get("process_list", [])]
        triggered = any(proc_list_item == active_proc or proc_list_item in active_proc for proc_list_item in proc_list if proc_list_item)
        detail = f"Aktif Süreç: {telemetry.get('active_proc')}" if triggered else ""
        return triggered, detail

    elif t_type == "gpu_temp_gte":
        gpu = telemetry.get("gpu", {})
        temp = gpu.get("temp_c", 0)
        threshold = trigger.get("threshold", 80)
        hysteresis = trigger.get("hysteresis", threshold - 6)
        if not is_active:
            triggered = temp >= threshold
        else:
            triggered = temp > hysteresis
        return triggered, f"GPU Sıcaklığı: {temp}°C (Eşik: {threshold}°C)"

    elif t_type == "cpu_load_gte":
        cpu = telemetry.get("cpu_percent", 0)
        threshold = trigger.get("threshold", 85)
        triggered = cpu >= threshold
        return triggered, f"CPU Yükü: %{cpu:.0f} (Eşik: %{threshold})"

    elif t_type == "battery_lte":
        bat = telemetry.get("battery")
        if not bat:
            return False, ""
        pct = bat.percent
        threshold = trigger.get("threshold", 25)
        is_discharging = not bat.power_plugged
        if trigger.get("require_discharging", True):
            triggered = (pct <= threshold) and is_discharging
        else:
            triggered = pct <= threshold
        return triggered, f"Pil: %{pct} ({'Pilde' if is_discharging else 'Prizde'})"

    elif t_type == "time_range":
        start_h = trigger.get("start_hour", 23)
        end_h = trigger.get("end_hour", 8)
        now_h = datetime.datetime.now().hour
        if start_h > end_h:
            triggered = (now_h >= start_h or now_h < end_h)
        else:
            triggered = (start_h <= now_h < end_h)
        return triggered, f"Mevcut Saat: {now_h:02d}:00"

    return False, ""

def evaluate_all_rules():
    with _engine_lock:
        if not _engine_data["enabled"]:
            return
        rules = _engine_data["rules"]

    # Gather telemetry snapshot
    gpu = {}
    cb_gpu = _server_callbacks.get("get_gpu_live")
    if cb_gpu and callable(cb_gpu):
        gpu = cb_gpu() or {}

    cpu_pct = psutil.cpu_percent(interval=None)
    bat = psutil.sensors_battery()
    active_proc = get_active_process_name()

    telemetry = {
        "gpu": gpu,
        "cpu_percent": cpu_pct,
        "battery": bat,
        "active_proc": active_proc
    }

    now = time.time()
    for rule in rules:
        if not rule.get("enabled", False):
            continue

        rule_state = rule.setdefault("state", {})
        is_active = rule_state.get("is_active", False)
        last_eval = rule_state.get("last_evaluated", 0)
        cooldown = rule.get("cooldown_sec", 5)

        if not is_active and (now - last_eval < cooldown):
            continue

        try:
            triggered, detail = evaluate_single_rule(rule, telemetry)
        except Exception as e:
            print(f"[RuleEngine] Error evaluating rule {rule.get('name')}: {e}")
            continue

        if triggered and not is_active:
            # TRIGGER FIRED!
            rule_state["saved_state"] = capture_current_system_state()
            rule_state["is_active"] = True
            rule_state["last_evaluated"] = now

            actions_labels = []
            for act in rule.get("actions", []):
                execute_action(act, rule.get("name", ""))
                actions_labels.append(act.get("label", act.get("type", "")))

            msg = f"{detail} ➔ {', '.join(actions_labels)}"
            append_history(rule.get("name", "Kural"), "trigger", msg)

        elif not triggered and is_active:
            # TRIGGER CLEARED!
            if rule.get("auto_revert", True):
                revert_rule_actions(rule)
            rule_state["is_active"] = False
            rule_state["last_evaluated"] = now
            rule_state["saved_state"] = {}

def _rule_engine_loop():
    print("[RuleEngine] Automation thread started.")
    time.sleep(3)  # Wait for server and probe to settle
    while True:
        try:
            evaluate_all_rules()
        except Exception as e:
            print(f"[RuleEngine] Loop exception: {e}")
        time.sleep(2.5)

def start_engine_thread():
    load_rules()
    t = threading.Thread(target=_rule_engine_loop, daemon=True, name="ZenithRuleEngine")
    t.start()
    return t

# API access helpers
def get_engine_data():
    with _engine_lock:
        if not _engine_data["rules"]:
            load_rules()
        return {
            "enabled": _engine_data["enabled"],
            "active_rules_count": sum(1 for r in _engine_data["rules"] if r.get("enabled")),
            "total_rules_count": len(_engine_data["rules"]),
            "rules": _engine_data["rules"],
            "history": _engine_data["history"][:40]
        }

def set_engine_master_state(enabled):
    with _engine_lock:
        _engine_data["enabled"] = bool(enabled)
    save_rules()
    append_history("Otomasyon Motoru", "trigger" if enabled else "revert", f"Kural motoru {'etkinleştirildi' if enabled else 'devre dışı bırakıldı'}.")
    return {"success": True, "enabled": _engine_data["enabled"]}

def toggle_rule_state(rule_id, enabled):
    target = None
    with _engine_lock:
        for r in _engine_data["rules"]:
            if r["id"] == rule_id:
                r["enabled"] = bool(enabled)
                target = r
                break
    if target:
        save_rules()
        append_history(target.get("name", rule_id), "trigger" if enabled else "revert", f"Kural {'aktif edildi' if enabled else 'kapatıldı'}.")
        return {"success": True, "rule": target}
    return {"success": False, "error": "Rule not found"}

def save_custom_rule(rule_dict):
    rule_id = rule_dict.get("id") or f"custom_rule_{int(time.time())}"
    rule_dict["id"] = rule_id
    rule_dict["is_preset"] = False
    rule_dict.setdefault("enabled", True)
    rule_dict.setdefault("state", {"is_active": False, "last_evaluated": 0, "saved_state": {}})

    with _engine_lock:
        existing_idx = next((i for i, r in enumerate(_engine_data["rules"]) if r["id"] == rule_id), None)
        if existing_idx is not None:
            _engine_data["rules"][existing_idx] = rule_dict
        else:
            _engine_data["rules"].append(rule_dict)
    save_rules()
    append_history(rule_dict.get("name", "Özel Kural"), "trigger", "Yeni kural kaydedildi.")
    return {"success": True, "rule": rule_dict}

def delete_rule(rule_id):
    deleted = False
    with _engine_lock:
        prev_len = len(_engine_data["rules"])
        _engine_data["rules"] = [r for r in _engine_data["rules"] if r["id"] != rule_id or r.get("is_preset", False)]
        deleted = len(_engine_data["rules"]) < prev_len
    if deleted:
        save_rules()
        append_history("Kural Silindi", "revert", f"'{rule_id}' kuralı kaldırıldı.")
        return {"success": True}
    return {"success": False, "error": "Rule cannot be deleted (preset or not found)"}

def clear_history_log():
    with _engine_lock:
        _engine_data["history"] = []
    save_rules()
    return {"success": True}

# Load rules upon module initialization so endpoints can access them immediately
load_rules()
