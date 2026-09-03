from typing import List, Optional
import re
from pydantic import BaseModel, Field, field_validator, model_validator, StrictStr

from src.models import ClassRecord
from src.course_parser import _parse_batch_section
from src.validator import canonicalize_room

class RoutineJSONClass(BaseModel):
    course_code: str = Field(..., min_length=1)
    group_code: str = Field(..., min_length=1)
    batch: Optional[str] = None
    section: Optional[str] = None
    subgroup: Optional[str] = None
    special_group: Optional[str] = None
    teacher: Optional[str] = ""
    room: str = Field(..., min_length=1)
    day: str
    start_time: str
    end_time: str

    @field_validator('course_code', 'group_code', 'room', 'teacher', mode='before')
    @classmethod
    def strip_whitespace(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator('course_code')
    @classmethod
    def validate_course_code(cls, v):
        # Allow any letters followed by digits, upper cased
        v = v.upper()
        if not re.match(r'^[A-Z]{2,6}\d{3,4}$', v):
            raise ValueError(f"Invalid course code structure: {v}")
        return v

    @field_validator('room')
    @classmethod
    def validate_room(cls, v):
        return canonicalize_room(v)

    @field_validator('day')
    @classmethod
    def validate_day(cls, v):
        v = v.strip().title()
        valid_days = {"Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}
        if v not in valid_days:
            raise ValueError(f"Invalid day: {v}. Must be one of {valid_days}")
        return v

    @field_validator('start_time', 'end_time', mode='before')
    @classmethod
    def validate_time(cls, v):
        if not isinstance(v, str):
            return v
        v = v.strip()
        # Handle AM/PM if accidentally provided
        if v.upper().endswith("AM") or v.upper().endswith("PM"):
            # Strip it, naive normalization, though 24-hour is canonical
            v = v.split()[0].strip()
        
        if not re.match(r'^(?:[01]\d|2[0-3]):[0-5]\d$', v):
            raise ValueError(f"Invalid time format: {v}. Must be HH:MM")
        return v

    @model_validator(mode='after')
    def validate_time_order(self) -> 'RoutineJSONClass':
        if self.start_time >= self.end_time:
            raise ValueError(f"Start time ({self.start_time}) must be before end time ({self.end_time})")
        return self

    @model_validator(mode='after')
    def derive_group_info(self) -> 'RoutineJSONClass':
        # If batch/section are missing, try to derive from group_code
        if self.batch is None and self.section is None:
            # Special case for RE_ and similar non-numerical groups
            if self.group_code.startswith("RE_"):
                self.special_group = self.group_code
            else:
                b, s, sub = _parse_batch_section(self.group_code)
                if b and s:
                    self.batch = b
                    self.section = s
                    self.subgroup = sub
                else:
                    # If we can't parse it as a standard batch/section, stick it in special_group
                    if "(" in self.group_code or ")" in self.group_code:
                        self.special_group = self.group_code
        return self

class RoutineJSONV1(BaseModel):
    format: str = Field(..., pattern="^diu-routine-v1$")
    semester: Optional[str] = None
    department: Optional[str] = None
    classes: List[RoutineJSONClass]

    def to_class_records(self) -> List[ClassRecord]:
        records = []
        
        # Sort classes deterministically for predictable IDs
        # day, start_time, room, course_code, group_code, teacher
        day_order = {"Saturday": 0, "Sunday": 1, "Monday": 2, "Tuesday": 3, "Wednesday": 4, "Thursday": 5, "Friday": 6}
        
        sorted_classes = sorted(self.classes, key=lambda c: (
            day_order.get(c.day, 99),
            c.start_time,
            c.room,
            c.course_code,
            c.group_code,
            c.teacher or ""
        ))
        
        for idx, cls in enumerate(sorted_classes, 1):
            records.append(ClassRecord(
                id=f"j{idx:05d}",
                semester=self.semester,
                page=0,  # JSON has no page
                day=cls.day,
                start_time=cls.start_time,
                end_time=cls.end_time,
                room=cls.room,
                course_code=cls.course_code,
                group_code=cls.group_code,
                batch=cls.batch,
                section=cls.section,
                subgroup=cls.subgroup,
                special_group=cls.special_group,
                teacher=cls.teacher or ""
            ))
            
        return records
