from __future__ import annotations
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.parser import parse_pdf
from db.database import connect, import_records


def main():
    ap = argparse.ArgumentParser(description="Parse a DIU routine PDF and import it into SQLite.")
    ap.add_argument("pdf")
    ap.add_argument("--db", default="data/routine.db")
    ap.add_argument("--name", default=None)
    args = ap.parse_args()

    pdf = Path(args.pdf)
    result = parse_pdf(pdf)
    conn = connect(args.db)
    version_id = import_records(
        conn,
        name=args.name or result.semester or pdf.stem,
        source_filename=pdf.name,
        semester=result.semester,
        pages_processed=result.summary.pages_processed,
        warning_count=len(result.warnings),
        repair_count=len(result.repairs),
        records=result.records,
    )
    print(f"Imported routine version: {version_id}")
    print(f"Records: {len(result.records)}")
    print(f"Warnings: {len(result.warnings)}")
    print(f"Repairs: {len(result.repairs)}")
    print(f"Database: {args.db}")

if __name__ == "__main__":
    main()
