import os
from src.parser import parse_pdf
from glob import glob

pdfs = glob("tests/fixtures/CSE Class*.pdf")

for pdf in pdfs:
    print(f"\n--- Testing {pdf} ---")
    result = parse_pdf(pdf)
    print(f"Records: {result.summary.classes_parsed}")
    print(f"Repairs: {len(result.diagnostics.repairs)}")
    print(f"Warnings: {result.summary.warnings}")
    print(f"Errors: {result.summary.fatal_errors}")
    print(f"AI Recoveries: {result.summary.ai_recoveries}")
    print(f"Unresolved: {result.summary.unresolved}")
    
    if result.summary.fatal_errors > 0:
        for err in result.diagnostics.fatal_errors:
            print(f"ERROR: {err.message}")
            
    if result.summary.unresolved > 0:
        for u in result.diagnostics.unresolved:
            print(f"UNRESOLVED: {u.raw_text} -> {u.message}")
