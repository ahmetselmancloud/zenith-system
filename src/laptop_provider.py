import os
import sys
import json
import subprocess
import winreg
import psutil

# Zenith System — Hardware Abstraction Layer (HAL)
# Multi-vendor Laptop Controller Provider:
# Supports MSI (Vector/Katana/Raider), ASUS (ROG/TUF), Lenovo (Legion), Acer and OS Fallbacks.

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

def silent_run(cmd, **kwargs):
    if sys.platform == "win32":
        kwargs.setdefault("creationflags", CREATE_NO_WINDOW)
    return subprocess.run(cmd, **kwargs)

def safe_reg_create_or_open(root, subkey):
    return winreg.CreateKeyEx(root, subkey, 0, winreg.KEY_SET_VALUE | winreg.KEY_READ)

class LaptopProvider:
    def __init__(self):
        self.vendor = "generic"
        self.model = "PC"
        self.detect_hardware()

    def detect_hardware(self):
        try:
            ps_cmd = "Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model | ConvertTo-Json -Compress"
            res = silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                             capture_output=True, text=True, timeout=3)
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                mfg = (data.get("Manufacturer") or "").lower()
                self.model = data.get("Model") or "PC"

                if "micro-star" in mfg or "msi" in mfg:
                    self.vendor = "msi"
                elif "asus" in mfg or "asustek" in mfg:
                    self.vendor = "asus"
                elif "lenovo" in mfg:
                    self.vendor = "lenovo"
                elif "acer" in mfg:
                    self.vendor = "acer"
                elif "dell" in mfg or "alienware" in mfg:
                    self.vendor = "dell"
                elif "hp" in mfg or "hewlett" in mfg:
                    self.vendor = "hp"
                else:
                    self.vendor = "generic"
        except Exception as e:
            print(f"[HAL] Hardware detection fallback: {e}")
            self.vendor = "generic"

    def get_info(self):
        return {
            "vendor": self.vendor,
            "model": self.model,
            "features": {
                "fan_control": True,
                "rgb_lighting": True,
                "battery_protection": True,
                "gpu_switch": True
            }
        }

    # 1. FAN & PERFORMANCE MODES
    def set_fan_profile(self, profile):
        """
        Profiles:
          - "extreme" / "cooler_boost" (Maksimum fan)
          - "balanced" (Dengeli)
          - "silent" (Sessiz)
          - "eco" / "super_battery" (Pil tasarrufu)
        """
        logs = []
        # OS Level Energy Performance Preference (EPP)
        epp_map = {"extreme": 0, "cooler_boost": 0, "balanced": 50, "silent": 85, "eco": 100}
        epp = epp_map.get(profile, 50)
        try:
            silent_run(["powercfg", "/setacvalueindex", "SCHEME_CURRENT", "SUB_PROCESSOR", "PERFEPP", str(epp)], timeout=2)
            silent_run(["powercfg", "/setdcvalueindex", "SCHEME_CURRENT", "SUB_PROCESSOR", "PERFEPP", str(epp)], timeout=2)
            silent_run(["powercfg", "/setactive", "SCHEME_CURRENT"], timeout=2)
            logs.append(f"OS EPP set to {epp}")
        except Exception as e:
            logs.append(f"OS EPP error: {e}")

        # Vendor Specific Hardware Overdrive
        if self.vendor == "msi":
            # MSI Center / Dragon Center Scenario Integration
            # Modes: 0=Extreme/Performance, 1=Balanced, 2=Silent, 3=SuperBattery, 4=User
            # Fan: 0=Auto, 1=Basic, 2=Advanced, 3=CoolerBoost
            msi_mode_map = {"extreme": 0, "turbo": 0, "cooler_boost": 0, "balanced": 1, "silent": 2, "eco": 3}
            mode_val = msi_mode_map.get(profile, 1)
            fan_val = 3 if profile in ("extreme", "turbo", "cooler_boost") else 0
            
            try:
                base_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Base Module\User Scenario"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, base_key) as k:
                    winreg.SetValueEx(k, "Mode", 0, winreg.REG_DWORD, mode_val)
                    winreg.SetValueEx(k, "ModeCH", 0, winreg.REG_DWORD, 1)

                gen_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Base Module\GeneralSetting"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, gen_key) as k:
                    winreg.SetValueEx(k, "Fan", 0, winreg.REG_DWORD, fan_val)
                logs.append(f"MSI User Scenario Mode={mode_val}, Fan={fan_val} updated successfully.")
            except Exception as e:
                logs.append(f"MSI registry scenario update notice: {e}")

        elif self.vendor == "asus":
            # ASUS Armoury Crate / G-Helper fan modes via WMI method
            try:
                asus_mode_map = {"extreme": 2, "turbo": 2, "balanced": 0, "silent": 1, "eco": 1}
                asus_val = asus_mode_map.get(profile, 0)
                ps_asus = f'Invoke-CimMethod -Namespace "root\\wmi" -ClassName "AsusAtkWmi_WMNB" -MethodName "Throttle_Thermal_Policy" -Arguments @{{ThermalPolicy={asus_val}}} -ErrorAction SilentlyContinue'
                silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_asus], timeout=2)
                logs.append(f"ASUS Throttle_Thermal_Policy({asus_val}) executed.")
            except Exception as e:
                logs.append(f"ASUS WMI fan error: {e}")

        elif self.vendor == "lenovo":
            # Lenovo Legion Performance mode via WMI
            try:
                lenovo_mode_map = {"extreme": 1, "turbo": 1, "balanced": 2, "silent": 3, "eco": 3}
                l_val = lenovo_mode_map.get(profile, 2)
                ps_lenovo = f'Invoke-CimMethod -Namespace "root\\wmi" -ClassName "Lenovo_ThermalMode" -MethodName "SetThermalMode" -Arguments @{{Mode={l_val}}} -ErrorAction SilentlyContinue'
                silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_lenovo], timeout=2)
                logs.append(f"Lenovo ThermalMode({l_val}) executed.")
            except Exception as e:
                logs.append(f"Lenovo WMI error: {e}")

        return {"success": True, "vendor": self.vendor, "profile": profile, "logs": logs}

    # 2. BATTERY CHARGE PROTECTION (E.g. %80 Health Limit)
    def set_battery_limit(self, limit_percent=80):
        logs = []
        is_protected = limit_percent <= 80

        if self.vendor == "msi":
            # BatteryMode in MSI Center: 1=Best for Mobility (100%), 2=Balanced (80%), 3=Best for Battery (60%)
            msi_bat_mode = 2 if limit_percent <= 80 else 1
            if limit_percent <= 60:
                msi_bat_mode = 3
            try:
                gen_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Base Module\GeneralSetting"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, gen_key) as k:
                    winreg.SetValueEx(k, "BatteryMode", 0, winreg.REG_DWORD, msi_bat_mode)
                logs.append(f"MSI Battery Health Mode set to {msi_bat_mode} (Target: {limit_percent}%)")
            except Exception as e:
                logs.append(f"MSI Battery Mode write notice: {e}")

        elif self.vendor == "asus":
            # ASUS Battery Health Charging via WMI (e.g. 80%)
            try:
                ps_asus = f'Invoke-CimMethod -Namespace "root\\wmi" -ClassName "AsusAtkWmi_WMNB" -MethodName "SetBatteryHealthCharging" -Arguments @{{Percent={limit_percent}}} -ErrorAction SilentlyContinue'
                silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_asus], timeout=2)
                logs.append(f"ASUS SetBatteryHealthCharging({limit_percent}) executed.")
            except Exception as e:
                logs.append(f"ASUS battery error: {e}")

        elif self.vendor == "lenovo":
            # Lenovo Conservation Mode (Stops at 80%)
            try:
                mode_bool = "$true" if is_protected else "$false"
                ps_len = f'Invoke-CimMethod -Namespace "root\\wmi" -ClassName "Lenovo_BatteryConservationMode" -MethodName "SetConservationMode" -Arguments @{{Enabled={mode_bool}}} -ErrorAction SilentlyContinue'
                silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_len], timeout=2)
                logs.append(f"Lenovo BatteryConservationMode set to {mode_bool}.")
            except Exception as e:
                logs.append(f"Lenovo battery error: {e}")

        return {"success": True, "vendor": self.vendor, "battery_limit": limit_percent, "logs": logs}

    # 3. GPU MUX SWITCH (Discrete / Hybrid / MSHybrid)
    def set_gpu_mode(self, mode):
        """Modes: 'dgpu' (Discrete only), 'mshybrid' (MSHybrid / Optimus)"""
        logs = []
        if self.vendor == "msi":
            # GPU_Switch: 1=Discrete, 2=MSHybrid
            target_val = 1 if mode == "dgpu" else 2
            try:
                gen_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Base Module\GeneralSetting"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, gen_key) as k:
                    winreg.SetValueEx(k, "GPU_Switch", 0, winreg.REG_DWORD, target_val)
                    winreg.SetValueEx(k, "GPUswitchDiscrete", 0, winreg.REG_DWORD, 1 if mode == "dgpu" else 0)
                logs.append(f"MSI GPU MUX Switch set to {mode} (Flag: {target_val}). Restart required for BIOS change.")
            except Exception as e:
                logs.append(f"MSI GPU switch write notice: {e}")

        elif self.vendor == "asus":
            try:
                # ASUS dGPU mode
                target_val = 0 if mode == "dgpu" else 1
                ps_asus = f'Invoke-CimMethod -Namespace "root\\wmi" -ClassName "AsusAtkWmi_WMNB" -MethodName "SetGpuEcoMode" -Arguments @{{State={target_val}}} -ErrorAction SilentlyContinue'
                silent_run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_asus], timeout=2)
                logs.append("ASUS GPU switch executed.")
            except Exception as e:
                logs.append(f"ASUS GPU switch error: {e}")

        return {"success": True, "vendor": self.vendor, "mode": mode, "logs": logs}

    # 4. KEYBOARD RGB LIGHTING
    def set_rgb_lighting(self, color_hex, effect="static", brightness=100, speed=5):
        logs = []
        hex_clean = color_hex.lstrip('#')
        if len(hex_clean) == 6:
            r = int(hex_clean[0:2], 16)
            g = int(hex_clean[2:4], 16)
            b = int(hex_clean[4:6], 16)
            dword_color = 0xFF000000 | (r << 16) | (g << 8) | b
        else:
            r, g, b = 255, 255, 255
            dword_color = 4278255615

        # Standard OS Dynamic Lighting Registry (for compatible HID/Windows 11 devices)
        eff_map = {"static": 0, "breathing": 1, "rainbow": 2, "wave": 3, "cycle": 4, "off": 0}
        eff_code = eff_map.get(effect, 0)
        eff_bright = 0 if effect == "off" else int(brightness)

        try:
            key_path = r"Software\Microsoft\Lighting"
            k = winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path)
            winreg.SetValueEx(k, "AmbientLightingEnabled", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(k, "Brightness", 0, winreg.REG_DWORD, eff_bright)
            winreg.SetValueEx(k, "Speed", 0, winreg.REG_DWORD, int(speed))
            winreg.SetValueEx(k, "EffectType", 0, winreg.REG_DWORD, eff_code)
            winreg.SetValueEx(k, "Color", 0, winreg.REG_DWORD, dword_color)
            winreg.CloseKey(k)
            logs.append("Windows Dynamic Lighting registry updated.")
        except Exception as e:
            logs.append(f"Windows lighting error: {e}")

        # Vendor Hardware Sync
        if self.vendor == "msi":
            # Effect code mapping for MSI Mystic Light (VID_1462&PID_1603 24 Zone Keyboard)
            # M01 = Static, M02 = Breathing, M03 = Rainbow Wave, M08 = Color Cycle, M00 = Off
            msi_eff_map = {
                "static": "M01",
                "breathing": "M02",
                "rainbow": "M03",
                "wave": "M03",
                "cycle": "M08",
                "off": "M00"
            }
            mode_code = msi_eff_map.get(effect, "M01")
            is_active = 1 if effect != "off" and brightness > 0 else 0

            try:
                # 1. Update MSI Mystic Light Active LED Profile
                ml_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Mystic Light\LED"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, ml_key) as k:
                    # Color format: R,G,B repeated across 24 zones
                    zone_rgb = f"{r},{g},{b}," * 24
                    winreg.SetValueEx(k, "Save_ColorBlock", 0, winreg.REG_SZ, zone_rgb)
                    setting_str = f"{mode_code},VID_1462&PID_1603,24 Zone,T,{is_active},{r},{g},{b},F,1,{speed}"
                    winreg.SetValueEx(k, "SettingData", 0, winreg.REG_SZ, setting_str)
                    winreg.SetValueEx(k, "ML_Keeper_CMD_Apply", 0, winreg.REG_DWORD, 1)
                    # CRITICAL: LEDKeeper2 only calls SynchronizeApplyAllEffectData if ML_UI_Apply is 'True'
                    winreg.SetValueEx(k, "ML_UI_Apply", 0, winreg.REG_SZ, "True")

                # 2. Update ML Control trigger if key exists
                try:
                    ctrl_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Mystic Light\ML Control"
                    with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, ctrl_key) as k:
                        winreg.SetValueEx(k, "ML_CMD_Apply", 0, winreg.REG_DWORD, 1)
                except Exception:
                    pass

                # 3. Update General Setting Backlight
                gen_key = r"SOFTWARE\WOW6432Node\MSI\MSI Center\Component\Base Module\GeneralSetting"
                with safe_reg_create_or_open(winreg.HKEY_LOCAL_MACHINE, gen_key) as k:
                    kb_level = 0 if not is_active else (1 if brightness < 50 else 2)
                    winreg.SetValueEx(k, "KBBacklight", 0, winreg.REG_DWORD, kb_level)

                logs.append("MSI Mystic Light & KBBacklight synced successfully.")
            except PermissionError:
                logs.append("Yönetici izni gerekli (Run Zenith.exe as Administrator).")
            except Exception as e:
                logs.append(f"MSI Mystic Light sync notice: {e}")

        return {"success": True, "vendor": self.vendor, "color": color_hex, "logs": logs}

# Global Singleton
laptop_hal = LaptopProvider()
