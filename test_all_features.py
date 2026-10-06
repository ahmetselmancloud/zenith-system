#!/usr/bin/env python3
import os
import sys
import subprocess

# Zenith System — Feature Test Runner entrypoint
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.join(ROOT_DIR, "scripts")
TEST_SCRIPT = os.path.join(SCRIPTS_DIR, "test_all_features.py")

if __name__ == "__main__":
    if os.path.exists(TEST_SCRIPT):
        res = subprocess.run([sys.executable, TEST_SCRIPT], cwd=ROOT_DIR)
        sys.exit(res.returncode)
    else:
        print(f"Error: {TEST_SCRIPT} not found.")
        sys.exit(1)
