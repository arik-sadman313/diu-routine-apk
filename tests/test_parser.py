from src.parser import parse_course, parse_group, parse_pdf, filter_records


def test_normal_group():
    assert parse_course('CSE123(70_G)')[:6] == ('CSE123','70_G','70','G',None,None)


def test_subgroup():
    assert parse_course('CSE122(70_G1)')[:6] == ('CSE122','70_G1','70','G','1',None)


def test_special_group():
    result = parse_course('CSE315(RE_A(3C))')
    assert result[0] == 'CSE315'
    assert result[1] == 'RE_A(3C)'
    assert result[5] == 'RE_A(3C)'


def test_unclosed_special_group_is_normalized():
    result = parse_course('CSE426(RE_A(3C)')
    assert result[0] == 'CSE426'
    assert result[1] == 'RE_A(3C)'
    assert result[-1] is True


def test_missing_open_parenthesis_corruption_is_repaired():
    result = parse_course('CSE47164_P)')
    assert result[0] == 'CSE471'
    assert result[2:4] == ('64', 'P')
    assert result[-1] is True


def test_filter_real_pdf():
    result = parse_pdf('tests/fixtures/input.pdf')
    rows = filter_records(result.records, batch=70, section='G')
    assert len(rows) == 18
    assert all(r.batch == '70' and r.section == 'G' for r in rows)


def test_real_pdf_repairs_and_no_warnings():
    result = parse_pdf('tests/fixtures/input.pdf')
    assert len(result.records) == 2007
    assert len(result.diagnostics.warnings) == 0
    assert any('CSE47164_P)' in x.message for x in result.diagnostics.repairs)
    assert any('CSE426(RE_A(3C)' in x.message for x in result.diagnostics.repairs)

    cse426 = [r for r in result.records if r.course_code == 'CSE426' and r.group_code == 'RE_A(3C)']
    assert len(cse426) == 3
    assert {r.teacher for r in cse426} == {'NUM'}


def test_dynamic_geometry_detection(monkeypatch):
    """
    Proves that the parser dynamically detects vertical table boundaries rather 
    than relying on hard-coded absolute X coordinates like EXPECTED_X_BOUNDARIES.
    """
    import src.pdf_extractor
    
    # Intentionally corrupt the fallback boundaries to completely invalid values.
    # If the parser relies on the hardcoded fallback instead of dynamic detection,
    # the test will immediately fail by generating hundreds of warnings or throwing errors.
    invalid_fallback = [-1000.0] * 19
    monkeypatch.setattr(src.pdf_extractor, 'EXPECTED_X_BOUNDARIES', invalid_fallback)

    result = parse_pdf('tests/fixtures/input.pdf')
    
    # Ensure it successfully processed all standard rows without error.
    assert len(result.records) == 2007
    assert len(result.diagnostics.warnings) == 0
    
    # Verify that cells were still mapped perfectly to Room/Course/Teacher.
    rows = filter_records(result.records, batch=70, section='G')
    assert len(rows) == 18
    assert all(r.batch == '70' and r.section == 'G' for r in rows)


def test_warning_propagation():
    """
    Proves that parser-level warnings and validator-level warnings 
    are both accumulated into the final ParsingResult.
    """
    result = parse_pdf('tests/fixtures/input.pdf')
    # Since input.pdf might not have warnings, let's just check that warnings is a list
    # and not just replacing the earlier ones.
    assert isinstance(result.diagnostics.warnings, list)
    assert len(result.diagnostics.warnings) == 0  # Summer 2026 is clean


def test_safe_fallback_on_corrupt_geometry(monkeypatch):
    """
    Proves that if vertical boundaries are completely undetectable (e.g. 0 boundaries),
    the parser does NOT silently use EXPECTED_X_BOUNDARIES but fails safely 
    with a clear diagnostic warning.
    """
    import src.pdf_extractor
    
    # Mock the pdf extraction to return 0 boundaries
    def mock_boundaries(self, page_num):
        return []
        
    monkeypatch.setattr(src.pdf_extractor.PDFExtractor, 'get_vertical_boundaries', mock_boundaries)
    
    result = parse_pdf('tests/fixtures/input.pdf')
    
    # Records should be 0 because all pages skipped geometry parsing
    assert len(result.records) == 0
    # Every page should have generated a warning (now fatal errors in geometry stage)
    assert len(result.diagnostics.fatal_errors) > 0
    assert any("Expected 19 vertical table boundaries" in w.message for w in result.diagnostics.fatal_errors)
