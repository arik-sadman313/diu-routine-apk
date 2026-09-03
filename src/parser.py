from __future__ import annotations
from pathlib import Path
from typing import Optional
import fitz

from .models import (
    ClassRecord, ParsingResult, ParsingSummary, 
    DiagnosticRecord, DiagnosticsModel, Severity, Stage, Resolution
)
from .normalization import normalize_cell
from .course_parser import parse_course_and_group

# Backward compatibility aliases for tests
parse_course = parse_course_and_group
parse_group = lambda x: (None, None, None, None)
from .evidence_engine import EvidenceEngine
from .ai.ai_recovery import AIRecoveryEngine
from .pdf_extractor import PDFExtractor
from .validator import RoutineValidator

DAYS = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
DAY_ORDER = {d.title(): i for i, d in enumerate(DAYS)}
TIME_SLOTS = [("08:30", "10:00"), ("10:00", "11:30"), ("11:30", "01:00"), ("01:00", "02:30"), ("02:30", "04:00"), ("04:00", "05:30")]
TIME_ORDER = {s: i for i, (s, _) in enumerate(TIME_SLOTS)}

def cell_text(words, x0, x1, y0, y1):
    inside = []
    for w in words:
        cx = (w['x0'] + w['x1']) / 2
        cy = (w['y0'] + w['y1']) / 2
        if x0 - .5 <= cx <= x1 + .5 and y0 - .5 <= cy <= y1 + .5:
            inside.append(w)
    inside.sort(key=lambda w: (w['y0'], w['x0']))
    lines = []
    for w in inside:
        if not lines or abs(w['y0'] - lines[-1][0]['y0']) > 2:
            lines.append([w])
        else:
            lines[-1].append(w)
    return " ".join(" ".join(x['text'] for x in line) for line in lines).strip()

def find_day_headings(words):
    return sorted([(w['text'], w['y0']) for w in words if w['text'] in DAYS], key=lambda x: x[1])

def sort_records(records):
    return sorted(records, key=lambda r: (DAY_ORDER.get(r.day, 99), TIME_ORDER.get(r.start_time, 99), r.room, r.course_code, r.group_code, r.teacher, r.page))

def infer_consistent_teachers(records):
    repairs = []
    known = {}
    for r in records:
        if r.teacher.strip():
            known.setdefault((r.course_code, r.group_code), set()).add(r.teacher.strip())
    for r in records:
        if not r.teacher.strip():
            candidates = known.get((r.course_code, r.group_code), set())
            if len(candidates) == 1:
                t = next(iter(candidates))
                r.teacher = t
                repairs.append(DiagnosticRecord(
                    severity=Severity.INFO, stage=Stage.DETERMINISTIC, resolution=Resolution.RECOVERED,
                    page=r.page, day=r.day, message=f"Filled blank teacher for {r.course_code}({r.group_code}) using evidence: {t}"
                ))
    return repairs

def parse_pdf(pdf_path: str | Path, manual_corrections: list[dict] | None = None, original_filename: str | None = None) -> ParsingResult:
    extractor = PDFExtractor(pdf_path, original_filename=original_filename)
    doc = extractor.doc
    semester = extractor.extract_semester()
    
    records = []
    warnings = []
    repairs = []
    errors = []
    ai_recoveries = []
    unresolved = []
    
    current_day = None
    rid = 0
    
    evidence_engine = EvidenceEngine()
    ai_engine = AIRecoveryEngine()
    
    # Pass 1: Extract all geometry and text cells
    all_cells = [] # (page_no, day, start_time, end_time, room, course_raw, teacher)
    
    for page_no, page in enumerate(doc, start=1):
        words = extractor.get_page_words(page_no)
        lines = extractor.get_horizontal_lines(page_no)
        xs = extractor.get_vertical_boundaries(page_no)
        headings = find_day_headings(words)
        cuts = []
        
        if len(xs) != 19:
            errors.append(DiagnosticRecord(severity=Severity.FATAL, stage=Stage.GEOMETRY, resolution=Resolution.NONE, page=page_no, message=f"Expected 19 vertical table boundaries, found {len(xs)}. Geometry failed."))
            continue
            
        if headings:
            first_y = headings[0][1]
            if current_day and first_y > 17:
                above = max((y for y in lines if y < first_y), default=17.72)
                cuts.append((current_day, 17.72, above))
            for idx, (day, hy) in enumerate(headings):
                current_day = day
                top = max((y for y in lines if y < hy), default=17.72)
                next_hy = headings[idx+1][1] if idx+1 < len(headings) else None
                end = max((y for y in lines if y < next_hy), default=page.rect.height) if next_hy else page.rect.height
                below = sorted(y for y in lines if y > top)
                data_start = below[2] if len(below) >= 3 else top
                cuts.append((day, data_start, end))
        elif current_day:
            cuts.append((current_day, 17.72, page.rect.height))
            
        for day, y_start, y_end in cuts:
            row_lines = sorted(set(y for y in lines if y >= y_start - .1 and y <= y_end + .1))
            for r_i in range(len(row_lines)-1):
                ry0, ry1 = row_lines[r_i], row_lines[r_i+1]
                if ry1 - ry0 < 5:
                    continue
                for slot in range(6):
                    base = slot * 3
                    room = cell_text(words, xs[base], xs[base+1], ry0, ry1)
                    course_raw = cell_text(words, xs[base+1], xs[base+2], ry0, ry1)
                    teacher = cell_text(words, xs[base+2], xs[base+3], ry0, ry1)
                    
                    if not course_raw or course_raw.upper() in {'RESERVED', 'IN CASE OF ANY', 'BOOKED'} or course_raw.lower().startswith('routine committee'):
                        continue
                        
                    start, end = TIME_SLOTS[slot]
                    all_cells.append({
                        "page": page_no,
                        "day": day.title(),
                        "start_time": start,
                        "end_time": end,
                        "room": room,
                        "course_raw": course_raw,
                        "teacher": teacher
                    })
                    
    # Pass 2: Deterministic Parser & Evidence Cataloging
    malformed_cells = []
    
    for cell in all_cells:
        raw = cell["course_raw"]
        norm_str = normalize_cell(raw)
        
        course_code, group_code, batch, section, subgroup, special, repaired = parse_course_and_group(raw)
        
        if course_code and group_code:
            # Deterministic success
            evidence_engine.add_course_evidence(norm_str, course_code, group_code, cell)
            
            if repaired:
                repairs.append(DiagnosticRecord(severity=Severity.INFO, stage=Stage.LOCAL_RECOVERY, resolution=Resolution.RECOVERED, page=cell["page"], day=cell["day"], message=f"Deterministic repair: {raw!r} -> {course_code}({group_code})", raw_text=raw, recovered_text=f"{course_code}({group_code})"))
                
            rid += 1
            records.append(ClassRecord(
                id=f"r{rid:05d}", semester=semester, page=cell["page"], day=cell["day"], 
                start_time=cell["start_time"], end_time=cell["end_time"], room=cell["room"], 
                course_code=course_code, group_code=group_code or '', batch=batch, 
                section=section, subgroup=subgroup, special_group=special, teacher=cell["teacher"]
            ))
        else:
            malformed_cells.append((cell, norm_str))
            
    # Pass 3: Hybrid Recovery for Malformed Cells
    for cell, norm_str in malformed_cells:
        raw = cell["course_raw"]
        
        # 1. Evidence Engine Recovery
        r_course, r_group = evidence_engine.attempt_course_recovery(norm_str, cell)
        if r_course:
            # Valid deterministic recovery via evidence
            c_batch, c_section, c_subgroup, c_special, _ = parse_course_and_group(f"{r_course}({r_group})")[2:]
            repairs.append(DiagnosticRecord(
                severity=Severity.INFO, stage=Stage.EVIDENCE, resolution=Resolution.RECOVERED, 
                page=cell["page"], day=cell["day"], time=cell["start_time"], room=cell["room"],
                message=f"Evidence repair: {raw!r} -> {r_course}({r_group})", 
                raw_text=raw, recovered_text=f"{r_course}({r_group})"
            ))
            rid += 1
            records.append(ClassRecord(
                id=f"r{rid:05d}", semester=semester, page=cell["page"], day=cell["day"], 
                start_time=cell["start_time"], end_time=cell["end_time"], room=cell["room"], 
                course_code=r_course, group_code=r_group or '', batch=c_batch, 
                section=c_section, subgroup=c_subgroup, special_group=c_special, teacher=cell["teacher"]
            ))
            continue
            
        # 2. AI Recovery Engine
        
        # Enrich context for AI
        same_row_cells = [c for c in all_cells if c["page"] == cell["page"] and c["day"] == cell["day"] and c["start_time"] == cell["start_time"] and c != cell]
        same_room_cells = [c for c in all_cells if c["page"] == cell["page"] and c["room"] == cell["room"] and c != cell]
        
        context = {
            "page": cell["page"],
            "day": cell["day"],
            "time": cell["start_time"],
            "room": cell["room"],
            "neighboring_cells_same_time": [f"{c['room']}: {c['course_raw']}" for c in same_row_cells if c["course_raw"]],
            "known_classes_in_room": [f"{c['day']} {c['start_time']}: {c['course_raw']}" for c in same_room_cells if c["course_raw"]][:5]
        }
        evidence_list = list(evidence_engine.known_courses.keys())
        ai_c, ai_g, ai_diag = ai_engine.attempt_recovery(norm_str, context, evidence_list)
        
        if ai_c:
            c_batch, c_section, c_subgroup, c_special, _ = parse_course_and_group(f"{ai_c}({ai_g})")[2:]
            
            # STRICT AI VALIDATION
            # 1. Reject if confidence < 0.60
            if ai_diag.get("confidence", 0) < 0.60:
                reject_reason = f"AI confidence too low: {ai_diag.get('confidence', 0)}"
                ai_c = None
            
            # 2. Reject if hallucinated course/group (doesn't exist anywhere in the PDF)
            elif f"{ai_c}({ai_g})" not in evidence_engine.known_courses:
                reject_reason = f"AI hallucinated unsupported course/group: {ai_c}({ai_g})"
                ai_c = None
                
            # 3. Reject if context contradicts (e.g., teacher doesn't match known teacher for this group)
            else:
                contexts = evidence_engine.known_courses[f"{ai_c}({ai_g})"]
                cell_teacher = cell.get("teacher", "").strip()
                cell_room = cell.get("room", "").strip()
                
                # If there are known contexts, at least one shouldn't vehemently contradict.
                # A strong contradiction is when the teacher is known to be X for this class, but this cell has teacher Y.
                teacher_contradicts = False
                known_teachers = []
                if cell_teacher:
                    # Does ANY context match this teacher?
                    known_teachers = [ctx.get("teacher") for ctx in contexts if ctx.get("teacher")]
                    if known_teachers and not any(t == cell_teacher for t in known_teachers):
                        teacher_contradicts = True
                            
                if teacher_contradicts:
                    reject_reason = f"AI assigned {ai_c}({ai_g}) but cell teacher '{cell_teacher}' contradicts known teachers {known_teachers}"
                    ai_c = None
            
            if ai_c:
                candidate = ClassRecord(
                    id=f"r{rid+1:05d}", semester=semester, page=cell["page"], day=cell["day"], 
                    start_time=cell["start_time"], end_time=cell["end_time"], room=cell["room"], 
                    course_code=ai_c, group_code=ai_g or '', batch=c_batch, 
                    section=c_section, subgroup=c_subgroup, special_group=c_special, teacher=cell["teacher"]
                )
                
                # 4. Strict Validator Pass
                v_warn, v_err = RoutineValidator().validate(records + [candidate])
                
                # If the candidate specifically caused a new warning or error, reject it
                # We can check this by seeing if there are any errors/warnings that mention the candidate's ID or properties.
                # A simple approach: count warnings/errors before and after.
                # Actually, RoutineValidator is stateless and evaluates the whole list.
                base_warn, base_err = RoutineValidator().validate(records)
                if len(v_err) > len(base_err) or len(v_warn) > len(base_warn):
                    reject_reason = f"AI assigned {ai_c}({ai_g}) but it failed strict validation (caused duplicate or conflict)"
                    ai_c = None
            
            if ai_c:
                # Accepted AI Recovery
                ai_recoveries.append(DiagnosticRecord(
                    severity=Severity.INFO, stage=Stage.AI, resolution=Resolution.RECOVERED,
                    page=cell["page"], day=cell["day"], time=cell["start_time"], room=cell["room"],
                    message=f"AI repair: {raw!r} -> {ai_c}({ai_g})",
                    raw_text=raw, recovered_text=f"{ai_c}({ai_g})", confidence=ai_diag.get("confidence", 0),
                    evidence=ai_diag.get("evidence", []), model_used=ai_diag.get("model_used", "")
                ))
                rid += 1
                records.append(candidate)
                continue
            else:
                # Rejected AI Recovery => Unresolved
                unresolved.append(DiagnosticRecord(
                    severity=Severity.WARNING, stage=Stage.AI, resolution=Resolution.REJECTED,
                    page=cell["page"], day=cell["day"], time=cell["start_time"], room=cell["room"],
                    raw_text=raw, message=f"AI recovery rejected: {reject_reason}"
                ))
                continue
        else:
            if raw != '\\':
                # Check for manual correction before marking as strictly unresolved
                manual_match = None
                if manual_corrections:
                    for mc in manual_corrections:
                        # Find matching context based on the composite key from unresolved diagnostics
                        if (mc.get("page") == cell["page"] and 
                            mc.get("day") == cell["day"] and 
                            mc.get("time") == cell["start_time"] and 
                            mc.get("room") == cell["room"] and 
                            mc.get("raw_text") == raw):
                            manual_match = mc
                            break
                            
                if manual_match:
                    mc_c, mc_g = manual_match["course_code"], manual_match["group_code"]
                    c_batch, c_section, c_subgroup, c_special, _ = parse_course_and_group(f"{mc_c}({mc_g})")[2:]
                    rid += 1
                    
                    mc_teacher = manual_match.get("teacher", "").strip()
                    mc_room = manual_match.get("room", cell["room"]).strip()
                    mc_day = manual_match.get("day", cell["day"]).strip()
                    mc_start = manual_match.get("start_time", cell["start_time"]).strip()
                    mc_end = manual_match.get("end_time", cell["end_time"]).strip()
                    
                    records.append(ClassRecord(
                        id=f"r{rid:05d}", semester=semester, page=cell["page"], day=mc_day, 
                        start_time=mc_start, end_time=mc_end, room=mc_room, 
                        course_code=mc_c, group_code=mc_g or '', batch=c_batch, 
                        section=c_section, subgroup=c_subgroup, special_group=c_special, teacher=mc_teacher
                    ))
                    repairs.append(DiagnosticRecord(
                        severity=Severity.INFO, stage=Stage.MANUAL, resolution=Resolution.RECOVERED,
                        page=cell["page"], day=cell["day"], time=cell["start_time"], room=cell["room"],
                        message=f"Manual review correction: {raw!r} -> {mc_c}({mc_g})",
                        raw_text=raw, recovered_text=f"{mc_c}({mc_g})"
                    ))
                    continue
            
                unresolved.append(DiagnosticRecord(
                    severity=Severity.WARNING, stage=Stage.AI, resolution=Resolution.UNRESOLVED,
                    page=cell["page"], day=cell["day"], time=cell["start_time"], room=cell["room"],
                    raw_text=raw, message="Failed deterministic parsing, evidence engine, and AI rejection."
                ))
                
    repairs.extend(infer_consistent_teachers(records))
    page_count = len(doc)
    extractor.close()
    
    # Run global validation on the final dataset (including AI recoveries)
    vwarn, verr = RoutineValidator().validate(records)
    warnings.extend(vwarn)
    errors.extend(verr)
    
    groups = {r.group_code for r in records if r.group_code}
    teachers = {r.teacher for r in records if r.teacher.strip()}
    rooms = {r.room for r in records if r.room}
    
    summary = ParsingSummary(
        pages_processed=page_count, classes_parsed=len(records), groups_found=len(groups),
        teachers_found=len(teachers), rooms_found=len(rooms), warnings=len(warnings),
        fatal_errors=len([e for e in errors if e.severity == Severity.FATAL]), 
        ai_recoveries=len(ai_recoveries), unresolved=len(unresolved)
    )
    
    diagnostics = DiagnosticsModel(
        repairs=repairs,
        warnings=warnings,
        ai_recoveries=ai_recoveries,
        unresolved=unresolved,
        fatal_errors=errors
    )
    
    return ParsingResult(
        semester=semester, records=sort_records(records), summary=summary,
        diagnostics=diagnostics
    )

def filter_records(records, batch=None, section=None, course=None, teacher=None, room=None):
    def match(r):
        return (
            (batch is None or r.batch == str(batch)) and 
            (section is None or (r.section or '').upper() == str(section).upper()) and 
            (course is None or r.course_code.upper() == str(course).upper()) and 
            (teacher is None or r.teacher.upper() == str(teacher).upper()) and 
            (room is None or r.room.upper() == str(room).upper())
        )
    return [r for r in records if match(r)]

def records_to_dicts(records): 
    return [r.model_dump() for r in records]
