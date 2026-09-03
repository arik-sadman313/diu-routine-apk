import re
from typing import Optional, Tuple

from .normalization import normalize_cell

def _parse_batch_section(group_inner: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parses strings like '65_H' or 'RE_B' or 'RE_A1' or '64_B_C' 
    Returns: (batch, section, subgroup)
    """
    m = re.fullmatch(r"^(\d+)_([A-Za-z]+?)(\d*)$", group_inner)
    if m:
        batch, section, subgroup = m.groups()
        return batch, section.upper(), subgroup or None
    if group_inner.startswith("RE_"):
        # RE_ group usually doesn't have a numerical batch in the same spot, but we return special info as needed.
        # This will be handled upstream.
        return None, None, None
    return None, None, None

def parse_course_and_group(raw: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str], Optional[str], bool]:
    """
    A structural parser for course and group codes.
    Handles balanced parentheses parsing.
    Returns: (course_code, group_code, batch, section, subgroup, special_group, repaired)
    """
    norm_str = normalize_cell(raw)
    if not norm_str:
        return None, None, None, None, None, None, False
        
    repaired = False
    
    # Simple prefix matcher: look for 3-5 letters followed by 3 digits
    prefix_match = re.match(r'^([A-Za-z]{3,5})\s*(\d{3})', norm_str)
    if not prefix_match:
        # If it doesn't even look like a course code, fail.
        return None, None, None, None, None, None, False
        
    course_code = (prefix_match.group(1) + prefix_match.group(2)).upper()
    
    # Now look for the group part, which is usually wrapped in parentheses.
    remainder = norm_str[prefix_match.end():].strip()
    
    if not remainder:
        # No group specified
        return course_code, "", None, None, None, None, False
        
    if remainder.startswith('('):
        # State machine to extract balanced group code
        depth = 0
        group_content = ""
        for i, char in enumerate(remainder):
            if char == '(':
                depth += 1
                if depth > 1:
                    group_content += char
            elif char == ')':
                depth -= 1
                if depth > 0:
                    group_content += char
                elif depth == 0:
                    break
            else:
                if depth > 0:
                    group_content += char
                    
        if depth > 0:
            # Unclosed parentheses
            repaired = True
            if depth > 1:
                group_content += ')' * (depth - 1)
            
        group_code = group_content.strip()
        
        # Now parse the actual group semantics
        batch, section, subgroup = _parse_batch_section(group_code.split('(')[0].strip())
        special_group = group_code if group_code.startswith("RE_") else None
        
        # We enforce strict returning of the repaired full group string with outer parens removed
        return course_code, group_code, batch, section, subgroup, special_group, repaired
        
    # Maybe it's missing the opening parenthesis? "65_H)"
    if remainder.endswith(')') and '_' in remainder:
        group_code = remainder[:-1].strip()
        batch, section, subgroup = _parse_batch_section(group_code)
        if batch or group_code.startswith("RE_"):
            return course_code, group_code, batch, section, subgroup, group_code if group_code.startswith("RE_") else None, True
            
    return None, None, None, None, None, None, False
