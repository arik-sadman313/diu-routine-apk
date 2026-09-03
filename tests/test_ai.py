import os
from src.parser import parse_pdf
from glob import glob
from src.ai.gemini_client import get_gemini_api_key

print(f"Has API key: {bool(get_gemini_api_key())}")

pdf = "tests/fixtures/dummy_422.pdf"  # Fixture in tests/fixtures/
result = parse_pdf(pdf)

print(f"AI Recoveries: {result.summary.ai_recoveries}")
print(f"Unresolved: {result.summary.unresolved}")

if result.summary.unresolved > 0:
    for u in result.diagnostics.unresolved:
        print(f"UNRESOLVED: {u.raw_text} -> {u.message}")
