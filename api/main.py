from __future__ import annotations

import tempfile
import hashlib
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware

from src.parser import parse_pdf
from src.json_importer import RoutineJSONV1
from src.validator import RoutineValidator
from src.models import DiagnosticsModel, ParsingSummary

from db.database import connect, import_records, latest_version_id
from api.planner import router as planner_router

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB = BASE_DIR / "data" / "routine.db"

app = FastAPI(
    title="DIU CSE Routine API",
    version="1.0.0",
    description="Personal, deterministic API for searching parsed DIU CSE routines.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(planner_router)


def db_path() -> Path:
    return Path(__import__("os").environ.get("ROUTINE_DB", str(DEFAULT_DB)))


def get_conn():
    return connect(db_path())


def resolve_version(conn, version_id: Optional[int]) -> int:
    version = version_id if version_id is not None else latest_version_id(conn)
    if version is None:
        raise HTTPException(status_code=404, detail="No routine has been imported yet.")
    exists = conn.execute("SELECT 1 FROM routine_versions WHERE id=?", (version,)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail=f"Routine version {version} was not found.")
    return int(version)


def row_to_dict(row):
    d = dict(row)
    for k in ['created_at', 'updated_at']:
        if k in d and isinstance(d[k], str) and ' ' in d[k] and not d[k].endswith('Z'):
            d[k] = d[k].replace(' ', 'T') + 'Z'
    return d


@app.get("/api/health")
def health():
    conn = get_conn()
    try:
        version = latest_version_id(conn)
        return {"status": "ok", "database": str(db_path()), "latest_version_id": version}
    finally:
        conn.close()


@app.get("/api/versions")
def versions():
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT id, name, source_filename, semester, created_at,
                      pages_processed, record_count, warning_count, repair_count
               FROM routine_versions ORDER BY id DESC"""
        ).fetchall()
        return {"versions": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@app.get("/api/versions/{version_id}")
def version_detail(version_id: int):
    conn = get_conn()
    try:
        row = conn.execute(
            """SELECT id, name, source_filename, semester, created_at,
                      pages_processed, record_count, warning_count, repair_count
               FROM routine_versions WHERE id=?""", (version_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Routine version not found.")
        return row_to_dict(row)
    finally:
        conn.close()


@app.get("/api/options")
def options(version_id: Optional[int] = Query(default=None)):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        def values(column: str):
            rows = conn.execute(
                f"SELECT DISTINCT {column} FROM effective_classes WHERE routine_version_id=? AND record_type != 'hidden' AND {column} IS NOT NULL AND {column} != '' ORDER BY {column}",
                (version,),
            ).fetchall()
            return [r[0] for r in rows]
        pairs = conn.execute(
            """SELECT DISTINCT batch, section FROM effective_classes
               WHERE routine_version_id=? AND record_type != 'hidden' AND batch IS NOT NULL AND section IS NOT NULL
               ORDER BY CAST(batch AS INTEGER), section""", (version,)
        ).fetchall()
        return {
            "version_id": version,
            "batches": values("batch"),
            "sections": values("section"),
            "courses": values("course_code"),
            "teachers": values("teacher"),
            "rooms": values("room"),
            "groups": values("group_code"),
            "batch_sections": [{"batch": r[0], "section": r[1]} for r in pairs],
        }
    finally:
        conn.close()


@app.get("/api/classes")
def classes(
    version_id: Optional[int] = Query(default=None),
    batch: Optional[str] = Query(default=None),
    section: Optional[str] = Query(default=None),
    course: Optional[str] = Query(default=None),
    teacher: Optional[str] = Query(default=None),
    room: Optional[str] = Query(default=None),
    group: Optional[str] = Query(default=None),
    day: Optional[str] = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        clauses = ["routine_version_id=?"]
        params: list = [version]
        for col, val in [
            ("batch", batch), ("section", section), ("course_code", course),
            ("teacher", teacher), ("room", room), ("group_code", group), ("day", day),
        ]:
            if val is not None:
                clauses.append(f"UPPER({col})=UPPER(?)")
                params.append(val)
        params.append(limit)
        rows = conn.execute(
            """SELECT id, record_type, page, day, start_time, end_time, room, course_code,
                      group_code, batch, section, subgroup, special_group, teacher
               FROM effective_classes WHERE """ + " AND ".join(clauses) +
            """ ORDER BY CASE day
                WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
                WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6
                WHEN 'Friday' THEN 7 ELSE 99 END,
                start_time, room, course_code, group_code LIMIT ?""",
            params,
        ).fetchall()
        return {"version_id": version, "count": len(rows), "classes": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


@app.get("/api/routine/{batch}/{section}")
def routine(batch: str, section: str, version_id: Optional[int] = Query(default=None)):
    result = classes(version_id, batch, section, None, None, None, None, None, 5000)
    return result


@app.get("/api/search")
def search(
    q: str = Query(min_length=1),
    version_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        pattern = f"%{q}%"
        rows = conn.execute(
            """SELECT id, record_type, page, day, start_time, end_time, room, course_code,
                      group_code, batch, section, subgroup, special_group, teacher
               FROM effective_classes
               WHERE routine_version_id=?
                 AND (course_code LIKE ? COLLATE NOCASE
                      OR group_code LIKE ? COLLATE NOCASE
                      OR batch LIKE ? COLLATE NOCASE
                      OR section LIKE ? COLLATE NOCASE
                      OR teacher LIKE ? COLLATE NOCASE
                      OR room LIKE ? COLLATE NOCASE)
               ORDER BY CASE day
                WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
                WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6
                WHEN 'Friday' THEN 7 ELSE 99 END,
                start_time LIMIT ?""",
            (version, pattern, pattern, pattern, pattern, pattern, pattern, limit),
        ).fetchall()
        return {"version_id": version, "query": q, "count": len(rows), "classes": [row_to_dict(r) for r in rows]}
    finally:
        conn.close()


SESSION_DIR = Path("data/sessions")
SESSION_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/import/json")
async def import_json(routine: RoutineJSONV1):
    try:
        # Convert to internal records
        records = routine.to_class_records()
        
        # Validate records structurally using the same logic as PDF import
        warnings, errors = RoutineValidator().validate(records)
        
        # We enforce a strict NO-FATAL policy for JSON imports
        fatal_errors = [e for e in errors if e.severity.name == "FATAL"]
        if fatal_errors:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Routine JSON validation failed with fatal errors.",
                    "fatal_errors": [e.model_dump() for e in fatal_errors]
                }
            )
            
        # Hash the JSON to prevent duplicate identical imports
        content_bytes = routine.model_dump_json().encode("utf-8")
        file_hash = hashlib.sha256(content_bytes).hexdigest()
        
        conn = get_conn()
        try:
            row = conn.execute("SELECT id, name FROM routine_versions WHERE file_hash = ?", (file_hash,)).fetchone()
            if row:
                raise HTTPException(
                    status_code=409,
                    detail={"message": f"This JSON routine has already been imported as '{row['name']}' (Version {row['id']}).", "version_id": row['id']}
                )
                
            version_id = import_records(
                conn,
                name=f"{routine.semester or 'Unknown'} (JSON Import)",
                source_filename="JSON Upload",
                semester=routine.semester,
                pages_processed=0,
                warning_count=len(warnings),
                repair_count=0,
                records=records,
                file_hash=file_hash
            )
            
            return {
                "message": "Routine JSON imported successfully",
                "version_id": version_id,
                "semester": routine.semester,
                "department": routine.department,
                "record_count": len(records),
                "warning_count": len(warnings),
                "repair_count": 0,
                "unresolved_count": 0,
                "warnings": [w.model_dump() for w in warnings],
                "repairs": [],
                "unresolved": [],
                "fatal_errors": []
            }
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/export/json/{version_id}")
def export_json(version_id: int):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        
        # Get semester
        v_row = conn.execute("SELECT semester FROM routine_versions WHERE id=?", (version,)).fetchone()
        semester = v_row["semester"] if v_row else None
        
        # Export effective classes (after overrides)
        rows = conn.execute(
            """SELECT day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher 
               FROM effective_classes 
               WHERE routine_version_id=? 
               ORDER BY CASE day
                WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
                WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6
                WHEN 'Friday' THEN 7 ELSE 99 END,
                start_time, room, course_code, group_code""",
            (version,)
        ).fetchall()
        
        classes = []
        for r in rows:
            classes.append({
                "course_code": r["course_code"],
                "group_code": r["group_code"],
                "batch": r["batch"],
                "section": r["section"],
                "subgroup": r["subgroup"],
                "special_group": r["special_group"],
                "teacher": r["teacher"] if r["teacher"] else None,
                "room": r["room"],
                "day": r["day"],
                "start_time": r["start_time"],
                "end_time": r["end_time"]
            })
            
        return {
            "format": "diu-routine-v1",
            "semester": semester,
            "department": "CSE", # Default to CSE as per instructions
            "classes": classes
        }
    finally:
        conn.close()

@app.post("/api/upload")
async def upload_routine(
    file: UploadFile = File(...),
    name: Optional[str] = Query(default=None),
):
    filename = file.filename or "uploaded-routine.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF routine files are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="The uploaded file does not appear to be a PDF.")

    file_hash = hashlib.sha256(content).hexdigest()

    conn = get_conn()
    try:
        row = conn.execute("SELECT id, name FROM routine_versions WHERE file_hash = ?", (file_hash,)).fetchone()
        if row:
            raise HTTPException(
                status_code=409,
                detail={"message": f"This routine has already been imported as '{row['name']}' (Version {row['id']}).", "version_id": row['id']}
            )
    finally:
        conn.close()

    # Keep the original filename in the temporary path so semester detection
    # can use names such as "Summer-2026-Routine.pdf".
    safe_name = Path(filename).name
    suffix = Path(safe_name).suffix or ".pdf"
    
    import uuid
    session_id = str(uuid.uuid4())
    temp_path = SESSION_DIR / f"{session_id}_{safe_name}"
    
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        result = parse_pdf(temp_path, original_filename=filename)
        
        # Distinguish between fatal parsing errors and safe missing-data warnings
        fatal_issues = result.diagnostics.fatal_errors
        
        # We NO LONGER map warnings to fatal errors based on substrings.
        # Warnings like room conflicts stay warnings. If they were truly fatal,
        # RoutineValidator would have logged them in fatal_errors.
        
        if fatal_issues:
            # Clean up temp file
            if temp_path.exists():
                temp_path.unlink()
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Routine parsed with unresolved fatal errors; nothing was imported.",
                    "warnings": [w.model_dump() for w in fatal_issues],
                    "repairs": [r.model_dump() for r in result.diagnostics.repairs],
                    "ai_recoveries": [r.model_dump() for r in result.diagnostics.ai_recoveries],
                    "unresolved": [r.model_dump() for r in result.diagnostics.unresolved],
                },
            )
            
        if result.diagnostics.unresolved:
            return {
                "status": "needs_review",
                "session_id": session_id,
                "filename": filename,
                "name": name,
                "unresolved": [r.model_dump() for r in result.diagnostics.unresolved]
            }

        conn = get_conn()
        try:
            version_id = import_records(
                conn,
                name=name or result.semester or Path(filename).stem,
                source_filename=filename,
                semester=result.semester,
                pages_processed=result.summary.pages_processed,
                warning_count=len(result.diagnostics.warnings),
                repair_count=len(result.diagnostics.repairs),
                records=result.records,
                file_hash=file_hash,
            )
        finally:
            conn.close()
            
        if temp_path.exists():
            temp_path.unlink()
            
        return {
            "message": "Routine imported successfully.",
            "version_id": version_id,
            "semester": result.semester,
            "pages_processed": result.summary.pages_processed,
            "record_count": len(result.records),
            "warning_count": len(result.diagnostics.warnings),
            "repair_count": len(result.diagnostics.repairs),
            "ai_recoveries_count": len(result.diagnostics.ai_recoveries),
            "unresolved_count": len(result.diagnostics.unresolved),
            "warnings": [w.model_dump() for w in result.diagnostics.warnings],
            "repairs": [r.model_dump() for r in result.diagnostics.repairs],
            "ai_recoveries": [r.model_dump() for r in result.diagnostics.ai_recoveries],
            "unresolved": [r.model_dump() for r in result.diagnostics.unresolved],
        }
    except HTTPException:
        if temp_path.exists():
            temp_path.unlink()
        raise
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error parsing routine: {str(e)}")

@app.post("/api/upload/confirm")
async def confirm_upload(
    session_id: str = Form(...),
    filename: str = Form(...),
    name: str = Form(None),
    corrections: str = Form(...)  # JSON string of manual corrections
):
    import json
    
    # Locate the temp file
    temp_files = list(SESSION_DIR.glob(f"{session_id}_*"))
    if not temp_files:
        raise HTTPException(status_code=404, detail="Upload session not found or expired.")
        
    temp_path = temp_files[0]
    
    try:
        manual_corrections = json.loads(corrections)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid corrections format.")
        
    try:
        # Re-parse but inject manual corrections
        result = parse_pdf(temp_path, manual_corrections=manual_corrections, original_filename=filename)
        
        fatal_issues = result.diagnostics.fatal_errors
        
        if fatal_issues or result.diagnostics.unresolved:
            # We still have issues!
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Validation failed on manual corrections.",
                    "warnings": [w.model_dump() for w in fatal_issues],
                    "repairs": [r.model_dump() for r in result.diagnostics.repairs],
                    "ai_recoveries": [r.model_dump() for r in result.diagnostics.ai_recoveries],
                    "unresolved": [r.model_dump() for r in result.diagnostics.unresolved],
                },
            )
            
        file_hash = hashlib.sha256(temp_path.read_bytes()).hexdigest()
        
        conn = get_conn()
        try:
            version_id = import_records(
                conn,
                name=name or result.semester or Path(filename).stem,
                source_filename=filename,
                semester=result.semester,
                pages_processed=result.summary.pages_processed,
                warning_count=len(result.diagnostics.warnings),
                repair_count=len(result.diagnostics.repairs),
                records=result.records,
                file_hash=file_hash,
            )
        finally:
            conn.close()
            
        if temp_path.exists():
            temp_path.unlink()
            
        return {
            "message": "Routine imported successfully.",
            "version_id": version_id,
            "semester": result.semester,
            "pages_processed": result.summary.pages_processed,
            "record_count": len(result.records),
            "warning_count": len(result.diagnostics.warnings),
            "repair_count": len(result.diagnostics.repairs),
            "ai_recoveries_count": len(result.diagnostics.ai_recoveries),
            "unresolved_count": len(result.diagnostics.unresolved),
            "warnings": [w.model_dump() for w in result.diagnostics.warnings],
            "repairs": [r.model_dump() for r in result.diagnostics.repairs],
            "ai_recoveries": [r.model_dump() for r in result.diagnostics.ai_recoveries],
            "unresolved": [r.model_dump() for r in result.diagnostics.unresolved]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing corrections: {str(e)}")

class OverrideRequest(BaseModel):
    target_class_id: Optional[int] = None
    override_type: str
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    course_code: Optional[str] = None
    group_code: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    subgroup: Optional[str] = None
    special_group: Optional[str] = None
    teacher: Optional[str] = None


@app.post("/api/routine/{version_id}/overrides")
def create_override(version_id: int, req: OverrideRequest):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        if req.target_class_id is not None and req.target_class_id > 0:
            conn.execute("DELETE FROM personal_overrides WHERE routine_version_id=? AND target_class_id=?", (version, req.target_class_id))
            if req.override_type == 'hidden':
                conn.execute(
                    "INSERT INTO personal_overrides (routine_version_id, target_class_id, override_type) VALUES (?, ?, ?)",
                    (version, req.target_class_id, 'hidden')
                )
            else:
                conn.execute(
                    """INSERT INTO personal_overrides 
                       (routine_version_id, target_class_id, override_type, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (version, req.target_class_id, req.override_type, req.day, req.start_time, req.end_time, req.room, req.course_code, req.group_code, req.batch, req.section, req.subgroup, req.special_group, req.teacher)
                )
        else:
            if req.target_class_id is not None and req.target_class_id < 0:
                conn.execute("DELETE FROM personal_overrides WHERE routine_version_id=? AND id=? AND override_type='manually_added'", (version, -req.target_class_id))
            
            conn.execute(
                """INSERT INTO personal_overrides 
                   (routine_version_id, override_type, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
                   VALUES (?, 'manually_added', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (version, req.day, req.start_time, req.end_time, req.room, req.course_code, req.group_code, req.batch, req.section, req.subgroup, req.special_group, req.teacher)
            )
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()


@app.delete("/api/routine/{version_id}/classes/{class_id}")
def delete_override(version_id: int, class_id: int):
    conn = get_conn()
    try:
        version = resolve_version(conn, version_id)
        if class_id > 0:
            conn.execute("DELETE FROM personal_overrides WHERE routine_version_id=? AND target_class_id=?", (version, class_id))
        else:
            conn.execute("DELETE FROM personal_overrides WHERE routine_version_id=? AND id=? AND override_type='manually_added'", (version, -class_id))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()
