from src.parser import parse_pdf, filter_records

def test_real_pdf_repairs_and_count():
    r=parse_pdf('tests/fixtures/Summer-2026-Routine.pdf')
    assert len(r.records)==2007
    assert any('CSE47164_P)' in x.message for x in r.diagnostics.repairs)
    assert any('CSE426(RE_A(3C)' in x.message for x in r.diagnostics.repairs)
    c=[x for x in r.records if x.course_code=='CSE426' and x.group_code=='RE_A(3C)']
    assert len(c)==3 and {x.teacher for x in c}=={'NUM'}

def test_filter():
    r=parse_pdf('tests/fixtures/Summer-2026-Routine.pdf'); rows=filter_records(r.records,batch=70,section='G')
    assert len(rows)==18 and all(x.batch=='70' and x.section=='G' for x in rows)
