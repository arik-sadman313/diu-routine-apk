from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.parser import parse_pdf
from db.database import connect, import_records, latest_version_id
from db.query import search

PDF = Path(__file__).resolve().parents[0] / "fixtures/input.pdf"

def test_import_and_batch_section_query(tmp_path):
    result = parse_pdf(PDF)
    conn = connect(tmp_path / "routine.db")
    version = import_records(conn, name="Summer 2026", source_filename="input.pdf",
                             semester=result.semester, pages_processed=result.summary.pages_processed,
                             warning_count=len(result.diagnostics.warnings), repair_count=len(result.diagnostics.repairs),
                             records=result.records)
    assert version == latest_version_id(conn)
    rows = search(conn, version, batch="70", section="G")
    assert len(rows) == 18
    assert all(r["batch"] == "70" and r["section"] == "G" for r in rows)

def test_indexes_and_counts(tmp_path):
    result = parse_pdf(PDF)
    conn = connect(tmp_path / "routine.db")
    version = import_records(conn, name="Summer 2026", source_filename="input.pdf",
                             semester=result.semester, pages_processed=result.summary.pages_processed,
                             warning_count=len(result.diagnostics.warnings), repair_count=len(result.diagnostics.repairs),
                             records=result.records)
    count = conn.execute("SELECT COUNT(*) FROM classes WHERE routine_version_id=?", (version,)).fetchone()[0]
    assert count == len(result.records) == 2007
    assert conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_classes_batch_section'").fetchone()[0] == 1
