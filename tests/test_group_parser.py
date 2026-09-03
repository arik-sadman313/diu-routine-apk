from src.group_parser import parse_course_and_group

def test_normal(): assert parse_course_and_group('CSE123(70_G)')[:6]==('CSE123','70_G','70','G',None,None)
def test_subgroup(): assert parse_course_and_group('CSE122(70_G1)')[:6]==('CSE122','70_G1','70','G','1',None)
def test_special(): assert parse_course_and_group('CSE315(RE_A(3C))')[:6][5]=='RE_A(3C)'
def test_unclosed_special():
    r=parse_course_and_group('CSE426(RE_A(3C)'); assert r[1]=='RE_A(3C)' and r[-1]
def test_corrupt_open():
    r=parse_course_and_group('CSE47164_P)'); assert r[:4]==('CSE471','64_P','64','P') and r[-1]
