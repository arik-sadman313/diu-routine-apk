from __future__ import annotations
from typing import Optional, Any
from enum import Enum
from pydantic import BaseModel, Field

class ClassRecord(BaseModel):
    id: str
    semester: Optional[str] = None
    page: int
    day: str
    start_time: str
    end_time: str
    room: str
    course_code: str
    group_code: str
    batch: Optional[str] = None
    section: Optional[str] = None
    subgroup: Optional[str] = None
    special_group: Optional[str] = None
    teacher: str = ""

class ParseRepair(BaseModel):
    page: int
    day: Optional[str] = None
    message: str

class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    FATAL = "FATAL"

class Stage(str, Enum):
    EXTRACTION = "EXTRACTION"
    GEOMETRY = "GEOMETRY"
    NORMALIZATION = "NORMALIZATION"
    DETERMINISTIC = "DETERMINISTIC"
    LOCAL_RECOVERY = "LOCAL_RECOVERY"
    EVIDENCE = "EVIDENCE"
    AI = "AI"
    MANUAL = "MANUAL"
    VALIDATION = "VALIDATION"
    IMPORT = "IMPORT"

class Resolution(str, Enum):
    NONE = "NONE"
    RECOVERED = "RECOVERED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    UNRESOLVED = "UNRESOLVED"

class DiagnosticRecord(BaseModel):
    severity: Severity
    stage: Stage
    resolution: Resolution
    message: str
    page: Optional[int] = None
    day: Optional[str] = None
    time: Optional[str] = None
    room: Optional[str] = None
    raw_text: Optional[str] = None
    recovered_text: Optional[str] = None
    confidence: Optional[float] = None
    evidence: Optional[list[str]] = None
    model_used: Optional[str] = None

class ParsingSummary(BaseModel):
    pages_processed: int
    classes_parsed: int
    groups_found: int
    teachers_found: int
    rooms_found: int
    ai_calls: int = 0
    deterministic_recoveries: int = 0
    local_recoveries: int = 0
    same_pdf_recoveries: int = 0
    ai_recoveries: int = 0
    unresolved: int = 0
    warnings: int = 0
    fatal_errors: int = 0

class DiagnosticsModel(BaseModel):
    repairs: list[DiagnosticRecord] = Field(default_factory=list)
    warnings: list[DiagnosticRecord] = Field(default_factory=list)
    ai_recoveries: list[DiagnosticRecord] = Field(default_factory=list)
    unresolved: list[DiagnosticRecord] = Field(default_factory=list)
    fatal_errors: list[DiagnosticRecord] = Field(default_factory=list)

class ParsingResult(BaseModel):
    semester: Optional[str] = None
    records: list[ClassRecord] = Field(default_factory=list)
    summary: ParsingSummary
    diagnostics: DiagnosticsModel = Field(default_factory=DiagnosticsModel)
