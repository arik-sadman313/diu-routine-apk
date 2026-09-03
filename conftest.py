"""Root conftest.py — ensures the project root is always in sys.path
so that all test packages (tests/, tests/bugs/) can import `api`, `src`, `db`."""
import sys
from pathlib import Path

# Insert the project root at the front of sys.path unconditionally.
# This is idempotent: if already present, no duplicate is added.
root = str(Path(__file__).resolve().parent)
if root not in sys.path:
    sys.path.insert(0, root)
