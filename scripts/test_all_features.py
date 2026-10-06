import sys
import time
import json
import os

# Zenith System — Comprehensive Diagnostic & Function Test Suite
sys.path.append('src')

from zenith_server import (
    run_real_speedtest,
    get_catalog,
    get_profiles,
    search_winget,
    get_winget_upgrades,
    get_obd_report,
    evaluate_all_rules,
    get_engine_data,
    get_gpu_live,
    get_power_plans,
    toggle_microphone_mute
)
from laptop_provider import laptop_hal

results = {}

print("====================================================================")
print("       ZENITH SYSTEM — COMPREHENSIVE FUNCTION AUDIT & TEST          ")
print("====================================================================")

# 1. HARDWARE PROVIDER & HAL
print("\n[1/8] Testing Laptop HAL & Provider...")
try:
    info = laptop_hal.get_info()
    fan_res = laptop_hal.set_fan_profile("cooler_boost")
    bat_res = laptop_hal.set_battery_limit(80)
    gpu_res = laptop_hal.set_gpu_mode("dgpu")
    rgb_res = laptop_hal.set_rgb_lighting("#00f0ff", "static", 100, 5)
    results['hal'] = {
        'status': 'PASS',
        'info': info,
        'fan_logs': fan_res.get('logs'),
        'bat_logs': bat_res.get('logs'),
        'gpu_logs': gpu_res.get('logs'),
        'rgb_logs': rgb_res.get('logs')
    }
    print(f"  -> Detected: {info['vendor'].upper()} {info['model']}")
    print(f"  -> Fan EPP logs: {fan_res.get('logs')}")
    print(f"  -> RGB logs: {rgb_res.get('logs')}")
except Exception as e:
    results['hal'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> HAL Error: {e}")

# 2. REAL SPEEDTEST
print("\n[2/8] Testing Real Speedtest (Socket ping + Cloudflare throughput)...")
try:
    t0 = time.time()
    st = run_real_speedtest()
    dur = round(time.time() - t0, 2)
    results['speedtest'] = {'status': 'PASS', 'duration': dur, 'data': st}
    print(f"  -> Ping: {st.get('ping_ms')} ms | Download: {st.get('download_mbps')} Mbps")
    print(f"  -> Server: {st.get('server_location')} (Completed in {dur}s)")
except Exception as e:
    results['speedtest'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> Speedtest Error: {e}")

# 3. WINGET CATALOG & SEARCH
print("\n[3/8] Testing WinGet Catalog & Profiles...")
try:
    cat = get_catalog()
    profs = get_profiles()
    search = search_winget("brave")
    results['winget'] = {
        'status': 'PASS',
        'categories': len(cat.get('categories', [])),
        'packages': sum(len(c.get('packages', [])) for c in cat.get('categories', [])),
        'profiles': len(profs.get('profiles', [])),
        'search_hits': len(search)
    }
    print(f"  -> Categories: {len(cat.get('categories', []))} | Total Apps: {results['winget']['packages']}")
    print(f"  -> 1-Click Profiles: {len(profs.get('profiles', []))} profiles loaded")
    print(f"  -> Search 'brave': {len(search)} apps found")
except Exception as e:
    results['winget'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> WinGet Error: {e}")

# 4. GPU TELEMETRY (NVIDIA RTX 5070 Ti)
print("\n[4/8] Testing GPU Live Telemetry (nvidia-smi + cache)...")
try:
    gpu = get_gpu_live()
    results['gpu'] = {'status': 'PASS', 'data': gpu}
    print(f"  -> GPU Available: {gpu.get('available')}")
    if gpu.get('available'):
        print(f"  -> Temp: {gpu.get('temp_c')}°C | Load: {gpu.get('usage_percent')}% | VRAM: {gpu.get('vram_used_mb')}/{gpu.get('vram_total_mb')} MB | Power: {gpu.get('power_w')}W")
except Exception as e:
    results['gpu'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> GPU Error: {e}")

# 5. POWER PLANS
print("\n[5/8] Testing Windows Power Plans (powercfg)...")
try:
    pp = get_power_plans()
    results['power'] = {'status': 'PASS', 'plans': len(pp.get('plans', [])), 'active': pp.get('active_guid')}
    print(f"  -> Plans Available: {len(pp.get('plans', []))}")
    print(f"  -> Active Plan GUID: {pp.get('active_guid')}")
except Exception as e:
    results['power'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> Power Plan Error: {e}")

# 6. RULE ENGINE (IF / THEN)
print("\n[6/8] Testing Rule Engine...")
try:
    engine_data = get_engine_data()
    rules = engine_data.get('rules', [])
    eval_res = evaluate_all_rules()
    results['rules'] = {'status': 'PASS', 'count': len(rules), 'eval': eval_res}
    print(f"  -> Active Rules: {len(rules)}")
    print(f"  -> Evaluation Result: {eval_res}")
except Exception as e:
    results['rules'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> Rule Engine Error: {e}")

# 7. PC OBD-II HARDWARE DIAGNOSTICS
print("\n[7/8] Testing PC OBD-II Diagnostic Scan...")
try:
    obd = get_obd_report()
    results['obd'] = {'status': 'PASS', 'health': obd.get('health_score'), 'dtc_count': len(obd.get('dtc_codes', []))}
    print(f"  -> Health Score: {obd.get('health_score')}/100")
    print(f"  -> Total Hardware Fault Codes (DTC): {len(obd.get('dtc_codes', []))}")
except Exception as e:
    results['obd'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> OBD Error: {e}")

# 8. SYSTEM FIXER / TROUBLESHOOTER REPAIR ARSENAL
print("\n[8/8] Testing System Troubleshooter Tool Arsenal...")
try:
    from system_troubleshooter import get_troubleshoot_tools, get_troubleshooter_status
    tools = get_troubleshoot_tools()
    tool_list = tools.get('tools', [])
    results['fixer'] = {'status': 'PASS', 'tools_count': len(tool_list), 'tools': [t['id'] for t in tool_list]}
    print(f"  -> Registered Repair Tools: {len(tool_list)}")
    print(f"  -> Sample Tools: {', '.join([t['title'] for t in tool_list[:4]])}...")
except Exception as e:
    results['fixer'] = {'status': 'FAIL', 'error': str(e)}
    print(f"  -> Fixer Error: {e}")

print("\n====================================================================")
print("                          TEST SUMMARY                              ")
print("====================================================================")
for k, v in results.items():
    print(f"  [{v['status']}] {k.upper()}: {v.get('status')}")
print("====================================================================")
