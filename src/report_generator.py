import os
import sys
import json
import time
import datetime
import psutil

# Zenith System — Hardware & OBD Diagnostic HTML/PDF Report Generator
# Generates a standalone, beautiful, printable A4 HTML report with zero external dependencies.

def generate_system_html_report(hardware_data=None, obd_data=None, gpu_live=None, storage_diag=None):
    hw = hardware_data or {}
    obd = obd_data or {}
    gpu = gpu_live or {}
    st_diag = storage_diag or {}
    
    cpu = hw.get("cpu", {})
    gpus = hw.get("gpus", [])
    primary_gpu = gpus[0] if gpus else {}
    ram = hw.get("memory", {})
    battery = hw.get("battery", {})
    storage_list = st_diag.get("disks") or hw.get("storage", [])
    mb = hw.get("motherboard", {})
    bios = hw.get("bios", {})
    
    gen_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    hostname = os.environ.get("COMPUTERNAME", "Unknown-PC")
    user = os.environ.get("USERNAME", "User")
    
    # 1. OBD Health Score & DTC Codes
    obd_score = obd.get("overall_score") if obd.get("overall_score") is not None else obd.get("health_score", 100)
    dtc_codes = obd.get("dtc_codes", [])
    
    score_color = "#10b981" if obd_score >= 90 else ("#f59e0b" if obd_score >= 70 else "#ef4444")
    
    # 2. Storage rows
    storage_rows = ""
    for s in storage_list:
        disk_name = s.get("name") or s.get("model") or "NVMe / SATA Disk"
        disk_type = s.get("media_type") or s.get("bus_type") or s.get("type") or "SSD"
        disk_size = s.get("size_gb", 0)
        
        rem_health = s.get("remaining_health_pct")
        if rem_health is not None:
            health_txt = f"{rem_health}%"
        elif s.get("health_status"):
            health_txt = s.get("health_status")
        else:
            health_txt = "Sağlıklı (100%)"
            
        smart = s.get("smart_status") or {}
        temp_val = s.get("temperature_c") or smart.get("temp_c")
        temp_txt = f"{temp_val}°C" if temp_val is not None else "--"
        
        storage_rows += f"""
        <tr>
            <td><strong>{disk_name}</strong></td>
            <td>{disk_type}</td>
            <td>{disk_size} GB</td>
            <td>{health_txt}</td>
            <td>{temp_txt}</td>
        </tr>
        """
    if not storage_rows:
        storage_rows = "<tr><td colspan='5' style='text-align:center;'>Disk bilgisi alınamadı</td></tr>"

    # 3. DTC Fault rows
    dtc_rows = ""
    if dtc_codes:
        for dtc in dtc_codes:
            sev = (dtc.get("severity") or "info").lower()
            subsys = dtc.get("subsystem") or dtc.get("component") or "Sistem"
            dtc_rows += f"""
            <tr>
                <td><code>{dtc.get('code', 'DTC-000')}</code></td>
                <td><span class='badge badge-{sev}'>{sev.upper()}</span></td>
                <td>{subsys}</td>
                <td>{dtc.get('description', '')}</td>
                <td><small>{dtc.get('recommendation', 'İnceleme gerekebilir.')}</small></td>
            </tr>
            """
    else:
        dtc_rows = """
        <tr>
            <td colspan="5" style="text-align:center; color: #10b981; padding: 18px;">
                ✔ Aktif donanım arızası veya WHEA hatası bulunamadı. Donanım sağlığı mükemmel durumda.
            </td>
        </tr>
        """

    # 4. Live GPU Status
    gpu_temp = f"{gpu.get('temp_c', '--')}°C" if gpu.get('temp_c') is not None else "--"
    gpu_load = f"{gpu.get('usage_percent') if gpu.get('usage_percent') is not None else gpu.get('util_gpu_percent', '--')}%"
    gpu_vram = f"{gpu.get('vram_used_mb', 0)} / {gpu.get('vram_total_mb', 0)} MB" if gpu.get('vram_total_mb') else "--"

    # 5. CPU Stats
    total_cores = cpu.get("total_cores") or cpu.get("cores_physical") or psutil.cpu_count(logical=False) or 0
    total_threads = cpu.get("total_threads") or cpu.get("cores_logical") or psutil.cpu_count(logical=True) or 0
    p_cores = cpu.get("p_cores", "--")
    e_cores = cpu.get("e_cores", "--")

    # 6. Ram specs
    ram_gb = ram.get("total_gb", round(psutil.virtual_memory().total / (1024**3), 1))
    ram_type = ram.get("type", "DDR5")
    ram_speed = f"{ram.get('speed_mhz', '')} MHz" if ram.get('speed_mhz') else ""

    # 7. Battery Stats
    des_cap = battery.get("design_capacity_mwh", 0)
    rem_cap = battery.get("remaining_mwh", 0)
    if des_cap > 0 and rem_cap > 0:
        bat_health_str = f"{round((rem_cap / des_cap) * 100, 1)}%"
    else:
        bat_health_str = f"{battery.get('health_percent', '--')}%" if battery.get('health_percent') else "--"
    bat_cycle = battery.get("cycle_count", "--")
    bat_capacity_str = f"{rem_cap} / {des_cap} mWh" if (rem_cap and des_cap) else "--"

    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zenith System — Donanım & Teşhis Raporu ({hostname})</title>
    <style>
        :root {{
            --bg: #090d16;
            --card-bg: #111827;
            --border: #1f293d;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --cyan: #00f0ff;
            --green: #10b981;
            --red: #ef4444;
            --amber: #f59e0b;
        }}
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg);
            color: var(--text-main);
            padding: 30px;
            font-size: 14px;
            line-height: 1.5;
        }}
        .container {{
            max-width: 960px;
            margin: 0 auto;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--border);
            padding-bottom: 20px;
            margin-bottom: 25px;
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .brand-icon {{
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #00f0ff, #3b82f6);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 20px;
            color: #000;
        }}
        .brand h1 {{
            font-size: 24px;
            letter-spacing: 1px;
            font-weight: 800;
            background: linear-gradient(90deg, #fff, var(--cyan));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .meta-info {{
            text-align: right;
            font-size: 12px;
            color: var(--text-muted);
        }}
        .actions {{
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
        }}
        .btn {{
            background: linear-gradient(135deg, #00f0ff, #0077ff);
            color: #000;
            border: none;
            padding: 10px 18px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 13px;
        }}
        .card {{
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }}
        .card-title {{
            font-size: 16px;
            font-weight: 700;
            color: var(--cyan);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .grid-2 {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }}
        .grid-3 {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
        }}
        .spec-item {{
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            padding: 12px 14px;
            border-radius: 6px;
        }}
        .spec-lbl {{
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-muted);
            font-weight: 700;
            margin-bottom: 4px;
        }}
        .spec-val {{
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            word-break: break-word;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }}
        th, td {{
            text-align: left;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
        }}
        th {{
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            font-size: 12px;
            text-transform: uppercase;
        }}
        .badge {{
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
        }}
        .badge-warning {{ background: rgba(245, 158, 11, 0.2); color: var(--amber); }}
        .badge-critical {{ background: rgba(239, 68, 68, 0.2); color: var(--red); }}
        .badge-info {{ background: rgba(0, 240, 255, 0.2); color: var(--cyan); }}
        .score-circle {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            border: 4px solid {score_color};
            font-size: 22px;
            font-weight: 800;
            color: {score_color};
        }}
        .footer {{
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 30px;
            border-top: 1px solid var(--border);
            padding-top: 15px;
        }}
        @media print {{
            body {{
                background: #fff;
                color: #000;
                padding: 0;
            }}
            .card {{
                background: #fff;
                border: 1px solid #ddd;
                color: #000;
                page-break-inside: avoid;
            }}
            .spec-item {{
                background: #f9f9f9;
                border: 1px solid #eee;
            }}
            .spec-val {{ color: #000; }}
            .brand h1 {{ color: #000; -webkit-text-fill-color: #000; }}
            .actions {{ display: none !important; }}
            th {{ background: #eee; color: #333; }}
            td {{ border-bottom: 1px solid #ddd; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="actions">
            <button class="btn" onclick="window.print()">🖨️ Yazdır / PDF Olarak Kaydet</button>
            <button class="btn" style="background: rgba(255,255,255,0.1); color: #fff;" onclick="window.close()">Kapat</button>
        </div>

        <div class="header">
            <div class="brand">
                <div class="brand-icon">⚡</div>
                <div>
                    <h1>ZENITH SYSTEM</h1>
                    <div style="font-size: 12px; color: var(--text-muted);">Eksiksiz Donanım Envanteri ve Sağlık Teşhis Raporu</div>
                </div>
            </div>
            <div class="meta-info">
                <div><strong>Bilgisayar:</strong> {hostname}</div>
                <div><strong>Kullanıcı:</strong> {user}</div>
                <div><strong>Oluşturulma Tarihi:</strong> {gen_time}</div>
            </div>
        </div>

        <!-- OBD & HEALTH SUMMARY -->
        <div class="card">
            <div class="card-title">🩺 PC OBD-II Donanım Sağlığı & Teşhis Özeti</div>
            <div style="display: flex; align-items: center; gap: 24px;">
                <div class="score-circle">{obd_score}</div>
                <div>
                    <h3 style="color: #fff; margin-bottom: 4px;">Donanım Sağlık Skoru: {obd_score} / 100</h3>
                    <p style="color: var(--text-muted); font-size: 13px;">
                        WHEA Donanım mimarisi, PCIe veriyolu kararlılığı, PnP aygıt sürücüleri ve sistem olay günlükleri taranarak oluşturulmuştur.
                    </p>
                </div>
            </div>
            
            <h4 style="margin-top: 20px; margin-bottom: 8px; color: #fff; font-size: 13px;">Hata ve Durum Kayıtları (DTC Codes):</h4>
            <table>
                <thead>
                    <tr>
                        <th>Kod</th>
                        <th>Seviye</th>
                        <th>Bileşen</th>
                        <th>Açıklama</th>
                        <th>Öneri</th>
                    </tr>
                </thead>
                <tbody>
                    {dtc_rows}
                </tbody>
            </table>
        </div>

        <!-- CPU & MOTHERBOARD -->
        <div class="card">
            <div class="card-title">⚡ İşlemci (CPU) & Anakart</div>
            <div class="grid-2">
                <div class="spec-item">
                    <div class="spec-lbl">İşlemci Modeli</div>
                    <div class="spec-val">{cpu.get('model', 'Bilinmiyor')}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Çekirdek Yapısı</div>
                    <div class="spec-val">{total_cores} Fiziksel, {total_threads} Mantıksal Çekirdek (P: {p_cores}, E: {e_cores})</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Anakart</div>
                    <div class="spec-val">{mb.get('manufacturer', '')} {mb.get('product', 'Bilinmiyor')}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">BIOS Sürümü & Tarihi</div>
                    <div class="spec-val">{bios.get('version', 'Bilinmiyor')} ({bios.get('release_date', '')})</div>
                </div>
            </div>
        </div>

        <!-- GPU & MEMORY -->
        <div class="card">
            <div class="card-title">🎮 Ekran Kartı (GPU) & Bellek (RAM)</div>
            <div class="grid-2">
                <div class="spec-item">
                    <div class="spec-lbl">Grafik İşlemcisi (GPU)</div>
                    <div class="spec-val">{primary_gpu.get('name', 'Bilinmiyor')}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Canlı Telemetri</div>
                    <div class="spec-val">Sıcaklık: {gpu_temp} | Yük: {gpu_load} | VRAM: {gpu_vram}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Sistem Belleği (RAM)</div>
                    <div class="spec-val">{ram_gb} GB {ram_type} {ram_speed}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Kullanılabilir RAM</div>
                    <div class="spec-val">{round(psutil.virtual_memory().available / (1024**3), 1)} GB Boşta ({psutil.virtual_memory().percent}% Kullanılıyor)</div>
                </div>
            </div>
        </div>

        <!-- STORAGE & BATTERY -->
        <div class="card">
            <div class="card-title">💾 Depolama (SSD / HDD)</div>
            <table>
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Tür</th>
                        <th>Kapasite</th>
                        <th>Sağlık</th>
                        <th>Sıcaklık</th>
                    </tr>
                </thead>
                <tbody>
                    {storage_rows}
                </tbody>
            </table>
        </div>

        <!-- BATTERY -->
        <div class="card">
            <div class="card-title">🔋 Pil & Güç Durumu</div>
            <div class="grid-3">
                <div class="spec-item">
                    <div class="spec-lbl">Pil Sağlığı</div>
                    <div class="spec-val">{bat_health_str}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Döngü Sayısı (Cycle Count)</div>
                    <div class="spec-val">{bat_cycle}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-lbl">Kapasite</div>
                    <div class="spec-val">{bat_capacity_str}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            Zenith System V1.0.0 — Zero-Bloat Hardware & Diagnostic Suite<br>
            Rapor üretici kimliği: {hostname}\\{user}
        </div>
    </div>
</body>
</html>
"""
    return html
