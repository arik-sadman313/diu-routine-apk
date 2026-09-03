import pytest
from pydantic import ValidationError
from src.json_importer import RoutineJSONV1, RoutineJSONClass

def test_valid_json_class():
    data = {
        "course_code": "CSE331",
        "group_code": "61_M",
        "room": "G01-007",
        "day": "tuesday",
        "start_time": "10:00",
        "end_time": "11:30"
    }
    c = RoutineJSONClass(**data)
    assert c.course_code == "CSE331"
    assert c.group_code == "61_M"
    assert c.room == "G1-007" # canonicalized
    assert c.day == "Tuesday" # title cased
    assert c.batch == "61" # derived
    assert c.section == "M" # derived

def test_invalid_day():
    data = {
        "course_code": "CSE331",
        "group_code": "61_M",
        "room": "G1-007",
        "day": "Funday",
        "start_time": "10:00",
        "end_time": "11:30"
    }
    with pytest.raises(ValidationError) as exc:
        RoutineJSONClass(**data)
    assert "Invalid day" in str(exc.value)

def test_invalid_time_format():
    data = {
        "course_code": "CSE331",
        "group_code": "61_M",
        "room": "G1-007",
        "day": "Tuesday",
        "start_time": "10:0",
        "end_time": "11:30"
    }
    with pytest.raises(ValidationError) as exc:
        RoutineJSONClass(**data)
    assert "Invalid time format" in str(exc.value)

def test_time_ordering():
    data = {
        "course_code": "CSE331",
        "group_code": "61_M",
        "room": "G1-007",
        "day": "Tuesday",
        "start_time": "11:30",
        "end_time": "10:00"
    }
    with pytest.raises(ValidationError) as exc:
        RoutineJSONClass(**data)
    assert "Start time (11:30) must be before end time" in str(exc.value)

def test_json_importer_to_records():
    data = {
        "format": "diu-routine-v1",
        "semester": "Fall 2026",
        "department": "CSE",
        "classes": [
            {
                "course_code": "CSE331",
                "group_code": "61_M",
                "room": "G1-007",
                "day": "Tuesday",
                "start_time": "10:00",
                "end_time": "11:30"
            }
        ]
    }
    v1 = RoutineJSONV1(**data)
    records = v1.to_class_records()
    assert len(records) == 1
    assert records[0].id == "j00001"
    assert records[0].semester == "Fall 2026"
    assert records[0].batch == "61"
    assert records[0].section == "M"

def test_special_group_derivation():
    data = {
        "course_code": "CSE499",
        "group_code": "RE_B(3C)",
        "room": "L2",
        "day": "Thursday",
        "start_time": "14:30",
        "end_time": "16:00"
    }
    c = RoutineJSONClass(**data)
    assert c.batch is None
    assert c.section is None
    assert c.special_group == "RE_B(3C)"
