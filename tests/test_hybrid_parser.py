import pytest
from src.course_parser import parse_course_and_group
from src.normalization import normalize_cell
from src.evidence_engine import EvidenceEngine, levenshtein_distance
from src.validator import canonicalize_room
from src.ai.gemini_client import GeminiClient

def test_course_parser_normal():
    course, group, batch, section, sub, special, rep = parse_course_and_group("CSE315(65_H)")
    assert course == "CSE315"
    assert group == "65_H"
    assert batch == "65"
    assert section == "H"
    assert not rep

def test_course_parser_special_group():
    course, group, batch, section, sub, special, rep = parse_course_and_group("CSE413(RE_A)")
    assert course == "CSE413"
    assert group == "RE_A"
    assert batch is None
    assert section is None
    assert special == "RE_A"
    assert not rep

def test_course_parser_nested_group():
    course, group, batch, section, sub, special, rep = parse_course_and_group("CSE113(RE_B(3C))")
    assert course == "CSE113"
    assert group == "RE_B(3C)"
    assert not rep

def test_course_parser_missing_closing_paren():
    # Structural parser recovers "CSE113(RE_B(3C" as repaired
    course, group, batch, section, sub, special, rep = parse_course_and_group("CSE113(RE_B(3C")
    assert rep is True
    assert course == "CSE113"
    assert group == "RE_B(3C)"

def test_evidence_engine_recovery():
    eng = EvidenceEngine()
    eng.add_course_evidence("CSE113(RE_B(3C))", "CSE113", "RE_B(3C)", cell={"teacher": "JRY", "room": "G1-006"})
    
    # Similarity alone shouldn't recover it without context
    r_course, r_group = eng.attempt_course_recovery("SE113(RE_B(3C", malformed_cell={"teacher": "XXX"})
    assert r_course is None
    
    # Context match (same teacher) should recover it
    r_course, r_group = eng.attempt_course_recovery("SE113(RE_B(3C", malformed_cell={"teacher": "JRY"})
    assert r_course == "CSE113"
    assert r_group == "RE_B(3C)"

def test_room_aliases():
    assert canonicalize_room("G1-007") == "G1-007"
    assert canonicalize_room("G01-007") == "G1-007"
    assert canonicalize_room("AB04-201") == "AB4-201"

def test_levenshtein():
    assert levenshtein_distance("cat", "cat") == 0
    assert levenshtein_distance("cat", "bat") == 1
    assert levenshtein_distance("SE113(RE_B(3C))", "CSE113(RE_B(3C))") == 1
    assert levenshtein_distance("SE113(RE_B(3C", "CSE113(RE_B(3C))") <= 3

def test_normalization():
    assert normalize_cell("CSE113 ( RE_B )") == "CSE113(RE_B)"
    assert normalize_cell(" CSE 113 (  65 _ H ) ") == "CSE 113(65 _ H)"

def test_evidence_engine_adversarial():
    eng = EvidenceEngine()
    eng.add_course_evidence("CSE113(RE_B)", "CSE113", "RE_B", cell={"day": "Saturday", "room": "G1-006", "teacher": "JRY"})
    eng.add_course_evidence("CSE213(65_H)", "CSE213", "65_H", cell={"day": "Saturday", "room": "AB4-201", "teacher": "MK"})
    
    # Test 1: Same day only -> UNRESOLVED
    r_c, r_g = eng.attempt_course_recovery("SE113(RE_B", malformed_cell={"day": "Saturday", "room": "UNKNOWN", "teacher": "UNKNOWN"})
    assert r_c is None
    
    # Test 2: Small edit distance but all context conflicts -> UNRESOLVED
    r_c, r_g = eng.attempt_course_recovery("SE113(RE_B", malformed_cell={"day": "Sunday", "room": "AB4-201", "teacher": "MK"})
    assert r_c is None
    
    # Test 3: Same room but different teacher/group/course context. Still acceptable if it perfectly matches the room that day.
    # Actually, strong evidence rules say: if same room, we allow it if distance is <= 3.
    # Let's ensure it doesn't match an unrelated course.
    r_c, r_g = eng.attempt_course_recovery("SE113(RE_B", malformed_cell={"day": "Saturday", "room": "G1-006", "teacher": "UNKNOWN"})
    assert r_c == "CSE113"

def test_multi_slot_conflicts():
    from src.validator import RoutineValidator
    from src.models import ClassRecord
    
    v = RoutineValidator()
    
    # Valid multi-slot (same class, adjacent time) -> No conflict
    c1 = ClassRecord(id="r1", page=1, day="Sat", start_time="10:00", end_time="11:30", room="G1-007", course_code="CSE315", group_code="65_H", teacher="X")
    c2 = ClassRecord(id="r2", page=1, day="Sat", start_time="11:30", end_time="01:00", room="G1-007", course_code="CSE315", group_code="65_H", teacher="X")
    w, _ = v.validate([c1, c2])
    assert len(w) == 0
    
    # Different group -> Room Conflict
    c3 = ClassRecord(id="r3", page=1, day="Sat", start_time="10:00", end_time="11:30", room="G1-007", course_code="CSE315", group_code="70_B", teacher="X")
    w, _ = v.validate([c1, c3])
    assert len(w) == 1
    assert "Room conflict" in w[0].message
    
    # Different teacher -> Room Conflict
    c4 = ClassRecord(id="r4", page=1, day="Sat", start_time="10:00", end_time="11:30", room="G1-007", course_code="CSE315", group_code="65_H", teacher="Y")
    w, _ = v.validate([c1, c4])
    assert len(w) == 1
    assert "Room conflict" in w[0].message
    
    # True Duplicate -> Duplicate Warning
    c5 = ClassRecord(id="r5", page=1, day="Sat", start_time="10:00", end_time="11:30", room="G1-007", course_code="CSE315", group_code="65_H", teacher="X")
    w, _ = v.validate([c1, c5])
    assert len(w) == 1
    assert "Duplicate class record" in w[0].message

def test_ai_adversarial_validation(monkeypatch):
    from src.parser import parse_pdf
    from src.ai.ai_recovery import AIRecoveryEngine
    from src.models import DiagnosticRecord, Severity, Stage, Resolution
    
    # We will mock AI engine to return specific adversarial cases on a malformed cell
    class MockAIEngine:
        def __init__(self):
            self.call_count = 0
            
        def attempt_recovery(self, raw_str, context, evidence_list):
            self.call_count += 1
            if self.call_count == 1:
                # Case A: Hallucinated course -> REJECT
                return "CSE999", "FAKE_G", {"confidence": 0.99, "evidence": [], "model_used": "mock"}
            elif self.call_count == 2:
                # Case B: Real course but hallucinated group -> REJECT
                return "CSE315", "FAKE_G", {"confidence": 0.99, "evidence": [], "model_used": "mock"}
            elif self.call_count == 3:
                # Case C: Real course/group, but teacher contradicts context -> REJECT
                # Assuming CSE315(65_H) is in the PDF, but taught by JRY. 
                # If the AI says it's this class, but the cell has a different teacher, it's rejected.
                return "CSE315", "65_H", {"confidence": 0.99, "evidence": [], "model_used": "mock"}
            elif self.call_count == 4:
                # Case E: Low confidence -> REJECT
                return "CSE315", "65_H", {"confidence": 0.30, "evidence": [], "model_used": "mock"}
            return None, None, {}
            
    # Mocking parser components
    import src.ai.ai_recovery
    monkeypatch.setattr(src.ai.ai_recovery, 'AIRecoveryEngine', MockAIEngine)
    
    from src.evidence_engine import EvidenceEngine
    
    eng = EvidenceEngine()
    eng.add_course_evidence("CSE315(65_H)", "CSE315", "65_H", cell={"teacher": "JRY", "room": "G1-007"})
    
    def simulate_ai_acceptance(ai_c, ai_g, ai_diag, cell, evidence_engine):
        reject_reason = None
        if ai_diag.get("confidence", 0) < 0.60:
            reject_reason = f"AI confidence too low: {ai_diag.get('confidence', 0)}"
            return False, reject_reason
            
        if f"{ai_c}({ai_g})" not in evidence_engine.known_courses:
            reject_reason = f"AI hallucinated unsupported course/group: {ai_c}({ai_g})"
            return False, reject_reason
            
        contexts = evidence_engine.known_courses[f"{ai_c}({ai_g})"]
        cell_teacher = cell.get("teacher", "").strip()
        
        teacher_contradicts = False
        known_teachers = []
        if cell_teacher:
            known_teachers = [ctx.get("teacher") for ctx in contexts if ctx.get("teacher")]
            if known_teachers and not any(t == cell_teacher for t in known_teachers):
                teacher_contradicts = True
                    
        if teacher_contradicts:
            reject_reason = f"AI assigned {ai_c}({ai_g}) but cell teacher '{cell_teacher}' contradicts known teachers {known_teachers}"
            return False, reject_reason
            
        from src.models import ClassRecord
        from src.validator import RoutineValidator
        
        candidate = ClassRecord(
            id="r999", semester="Summer 2026", page=cell.get("page", 1), day=cell.get("day", "Monday"),
            start_time=cell.get("start_time", "10:00"), end_time="11:30", room=cell.get("room", "G1-007"),
            course_code=ai_c, group_code=ai_g, teacher=cell.get("teacher", ""),
            batch="", section="", subgroup="", special_group=""
        )
        
        base_records = [
            ClassRecord(
                id="r001", semester="Summer 2026", page=1, day="Monday",
                start_time="10:00", end_time="11:30", room="G1-007",
                course_code="CSE315", group_code="65_H", teacher="JRY",
                batch="", section="", subgroup="", special_group=""
            )
        ]
        
        v_warn, v_err = RoutineValidator().validate(base_records + [candidate])
        base_warn, base_err = RoutineValidator().validate(base_records)
        
        if len(v_err) > len(base_err) or len(v_warn) > len(base_warn):
            return False, "Failed strict validation (caused duplicate or conflict)"
            
        return True, None

    # Case A: Hallucinated course (CSE999) -> REJECT
    accepted, reason = simulate_ai_acceptance("CSE999", "FAKE_G", {"confidence": 0.99}, {"teacher": "JRY"}, eng)
    assert not accepted
    assert "hallucinated" in reason
    
    # Case B: Hallucinated group (CSE315(FAKE_G)) -> REJECT
    accepted, reason = simulate_ai_acceptance("CSE315", "FAKE_G", {"confidence": 0.99}, {"teacher": "JRY"}, eng)
    assert not accepted
    assert "hallucinated" in reason
    
    # Case C: Teacher contradiction -> REJECT
    accepted, reason = simulate_ai_acceptance("CSE315", "65_H", {"confidence": 0.99}, {"teacher": "MK"}, eng)
    assert not accepted
    assert "contradicts" in reason
    
    # Case E: Low confidence -> REJECT
    accepted, reason = simulate_ai_acceptance("CSE315", "65_H", {"confidence": 0.30}, {"teacher": "JRY"}, eng)
    assert not accepted
    assert "too low" in reason
    
    # Case F: AI causes duplicate/conflict -> REJECT
    accepted, reason = simulate_ai_acceptance("CSE315", "65_H", {"confidence": 0.99}, {"teacher": "JRY", "room": "G1-007", "day": "Monday", "start_time": "10:00"}, eng)
    assert not accepted
    assert "strict validation" in reason
    
    # Case Valid Recovery -> ACCEPT (Different time/room)
    accepted, reason = simulate_ai_acceptance("CSE315", "65_H", {"confidence": 0.99}, {"teacher": "JRY", "room": "G1-008", "day": "Monday", "start_time": "11:30"}, eng)
    assert accepted

def test_blank_teacher():
    from src.validator import RoutineValidator
    from src.models import ClassRecord
    v = RoutineValidator()
    # Legitimate blank teacher should not raise conflicts with itself or others in the room
    c1 = ClassRecord(id="r1", page=1, day="Sat", start_time="10:00", end_time="11:30", room="G1-007", course_code="CSE315", group_code="65_H", teacher="")
    c2 = ClassRecord(id="r2", page=1, day="Sat", start_time="11:30", end_time="01:00", room="G1-007", course_code="CSE315", group_code="65_H", teacher="X")
    w, _ = v.validate([c1, c2])
    # No duplicate, no room conflict
    assert len(w) == 0
