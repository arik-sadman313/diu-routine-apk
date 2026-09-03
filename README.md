# DIU CSE Routine Backend

Personal, deterministic DIU CSE routine system. The canonical PDF parser is the validated merged parser and uses embedded PDF text + coordinates with PyMuPDF. It does **not** use OCR or AI.

## Stack
- Python
- PyMuPDF
- Pydantic
- SQLite
- FastAPI
- Uvicorn

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Parse/filter the supplied test routine:

```bash
python run.py input/Summer-2026-Routine.pdf --batch 70 --section G
```

Import into SQLite:

```bash
python db/import_routine.py input/Summer-2026-Routine.pdf --db data/routine.db
```

Run the API:

```bash
python run_api.py
```

Open the interactive API docs at `http://127.0.0.1:8000/docs`.

## Main API endpoints

- `GET /api/health`
- `GET /api/versions`
- `GET /api/options`
- `GET /api/routine/{batch}/{section}`
- `GET /api/classes`
- `GET /api/search?q=...`
- `POST /api/upload`

## Validation result on Summer 2026 test PDF

- Pages: 10
- Records: 2007
- Warnings: 0
- Repairs: 5
- Batch 70 / Section G: 18 records

The parser preserves normal groups (`70_G`), lab subgroups (`70_G1`, `70_G2`) and special groups (`RE_A(...)`, etc.) without AI/OCR.
