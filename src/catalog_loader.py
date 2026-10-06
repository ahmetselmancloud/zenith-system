import os
import sys
import json
import subprocess
import threading

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG_DIR = os.path.join(BASE_DIR, "catalog")
PACKAGES_FILE = os.path.join(CATALOG_DIR, "packages.json")
PROFILES_FILE = os.path.join(CATALOG_DIR, "profiles.json")

_cache_lock = threading.Lock()
_catalog_cache = None
_profiles_cache = None

def get_catalog():
    global _catalog_cache
    with _cache_lock:
        if _catalog_cache:
            return _catalog_cache
        if os.path.exists(PACKAGES_FILE):
            try:
                with open(PACKAGES_FILE, "r", encoding="utf-8") as f:
                    _catalog_cache = json.load(f)
                    return _catalog_cache
            except Exception as e:
                print(f"[Catalog] Error reading packages.json: {e}")
        return {"categories": []}

def get_profiles():
    global _profiles_cache
    with _cache_lock:
        if _profiles_cache:
            return _profiles_cache
        if os.path.exists(PROFILES_FILE):
            try:
                with open(PROFILES_FILE, "r", encoding="utf-8") as f:
                    _profiles_cache = json.load(f)
                    return _profiles_cache
            except Exception as e:
                print(f"[Catalog] Error reading profiles.json: {e}")
        return {"profiles": []}

def parse_table_columns(lines, expected_cols):
    if len(lines) < 2:
        return []
    header = lines[0]
    spans = []
    for name in expected_cols:
        pos = header.find(name)
        if pos != -1:
            spans.append((name, pos))
    spans.sort(key=lambda x: x[1])
    if not spans:
        return []

    results = []
    # lines[1] is typically '----', so start from lines[2]
    start_row = 2 if lines[1].startswith("-") else 1
    for l in lines[start_row:]:
        if not l.strip() or l.startswith("<"):
            continue
        item = {}
        for idx, (col, start) in enumerate(spans):
            end = spans[idx + 1][1] if idx + 1 < len(spans) else len(l)
            val = l[start:min(end, len(l))].strip() if start < len(l) else ""
            item[col.lower()] = val
        if item.get("id"):
            results.append(item)
    return results

def search_winget(query: str, limit: int = 12):
    if not query or len(query.strip()) < 2:
        return []
    try:
        cmd = [
            "winget", "search", query.strip(),
            "-n", str(limit),
            "--accept-source-agreements",
            "--disable-interactivity"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=12, creationflags=CREATE_NO_WINDOW)
        lines = [l for l in res.stdout.splitlines() if l.strip()]
        if not lines:
            return []
        cols = ["Name", "Id", "Version", "Match", "Source"]
        return parse_table_columns(lines, cols)
    except Exception as e:
        print(f"[Winget Search] Error: {e}")
        return []

def get_winget_upgrades():
    try:
        cmd = [
            "winget", "upgrade",
            "--accept-source-agreements",
            "--disable-interactivity"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20, creationflags=CREATE_NO_WINDOW)
        lines = [l for l in res.stdout.splitlines() if l.strip()]
        if not lines:
            return []
        cols = ["Name", "Id", "Version", "Available", "Source"]
        return parse_table_columns(lines, cols)
    except Exception as e:
        print(f"[Winget Upgrades] Error: {e}")
        return []
