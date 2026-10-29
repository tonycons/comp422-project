#!/usr/bin/env bash
# =============================================================================
#  AI-GENERATED FILE - written by Claude (Anthropic AI), 2026-10-29,
#  at the request of George Rule. See AI_CONTRIBUTIONS.md.
# =============================================================================
#  The Greedy Raccoon - one-step launcher for macOS / Linux.
#    ./run.sh                 -> menu
#    ./run.sh demo --n 12     -> any main.py command
#  First run creates a private Python environment (.venv) and installs
#  numpy + matplotlib into it. Needs Python 3.9 or newer.
# =============================================================================
set -e
cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
    echo "First run: creating a Python environment in .venv ..."
    python3 -m venv .venv
fi

.venv/bin/python -m pip install --quiet --disable-pip-version-check -r requirements.txt
exec .venv/bin/python main.py "$@"
