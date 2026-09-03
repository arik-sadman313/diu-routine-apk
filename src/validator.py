from __future__ import annotations
import re
from .models import ClassRecord, DiagnosticRecord, Severity, Stage, Resolution

def canonicalize_room(room: str) -> str:
    """
    Transforms room aliases like 'G01-007' into 'G1-007'.
    """
    if not room:
        return room
    # Remove leading zero from floor numbers if present
    m = re.sub(r'([a-zA-Z])0+(\d+)', r'\1\2', room.strip().upper())
    return m

class RoutineValidator:
    def validate(self, records: list[ClassRecord]):
        warnings = []
        errors = []
        
        # Build logical groups to handle multi-slot classes correctly
        # Key: (day, room, course_code, group_code, teacher)
        # Value: list of records
        
        seen_exact = set()
        rooms = {}
        teachers = {}
        
        for r in records:
            if not r.course_code:
                errors.append(DiagnosticRecord(severity=Severity.ERROR, stage=Stage.VALIDATION, resolution=Resolution.NONE, message=f'{r.id} has missing course code', page=r.page))
            elif not re.fullmatch(r'[A-Z]{2,5}\d{3,4}', r.course_code):
                warnings.append(DiagnosticRecord(severity=Severity.WARNING, stage=Stage.VALIDATION, resolution=Resolution.NONE, message=f'{r.id} has unusual course code: {r.course_code}', page=r.page))
                
            if not r.room:
                errors.append(DiagnosticRecord(severity=Severity.ERROR, stage=Stage.VALIDATION, resolution=Resolution.NONE, message=f'{r.id} has missing room', page=r.page))
                
            c_room = canonicalize_room(r.room)
            
            # 1. True Duplicate Detection
            # Exact logical identity across all meaningful fields
            sig = (r.day, r.start_time, r.end_time, c_room, r.course_code, r.group_code, r.teacher.strip() if r.teacher else '')
            if sig in seen_exact:
                warnings.append(DiagnosticRecord(severity=Severity.WARNING, stage=Stage.VALIDATION, resolution=Resolution.NONE, message=f'Duplicate class record: {r.course_code}({r.group_code}) {r.day} {r.start_time} {r.room}', page=r.page))
            seen_exact.add(sig)
            
            # 2. Strict Room Conflicts
            # Two records in the same room at the same time MUST be the same logical class.
            rk = (r.day, r.start_time, c_room)
            if rk in rooms:
                existing = rooms[rk]
                # If course, group, or teacher differ, it's a room conflict.
                existing_teacher = existing.teacher.strip() if existing.teacher else ''
                r_teacher = r.teacher.strip() if r.teacher else ''
                
                if (existing.course_code != r.course_code) or (existing.group_code != r.group_code) or (existing_teacher != r_teacher):
                    warnings.append(DiagnosticRecord(
                        severity=Severity.WARNING, stage=Stage.VALIDATION, resolution=Resolution.NONE,
                        message=f'Room conflict: {r.room} is booked for {existing.course_code}({existing.group_code})[{existing_teacher}] and {r.course_code}({r.group_code})[{r_teacher}] at {r.day} {r.start_time}', 
                        page=r.page
                    ))
            else:
                rooms[rk] = r
                
            # 3. Strict Teacher Conflicts
            # A teacher cannot be in two different canonical rooms at the same time.
            if r.teacher and r.teacher.strip():
                tk = (r.day, r.start_time, r.teacher.strip())
                if tk in teachers:
                    existing = teachers[tk]
                    if canonicalize_room(existing.room) != c_room:
                        warnings.append(DiagnosticRecord(
                            severity=Severity.WARNING, stage=Stage.VALIDATION, resolution=Resolution.NONE,
                            message=f'Teacher conflict: {r.teacher} is assigned to {existing.room} and {r.room} at {r.day} {r.start_time}', 
                            page=r.page
                        ))
                else:
                    teachers[tk] = r
                    
        return warnings, errors
