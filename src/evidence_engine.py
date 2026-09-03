def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

class EvidenceEngine:
    def __init__(self):
        # Maps canonical course strings to a list of contexts they appeared in
        self.known_courses = {}

    def add_course_evidence(self, norm_str: str, course_code: str, group_code: str, cell: dict = None):
        """
        Registers a successfully parsed course string as evidence, along with its context.
        """
        canonical = f"{course_code}({group_code})"
        
        if canonical not in self.known_courses:
            self.known_courses[canonical] = []
            
        if cell:
            context = {
                "day": cell.get("day"),
                "start_time": cell.get("start_time"),
                "room": cell.get("room"),
                "teacher": cell.get("teacher"),
            }
            self.known_courses[canonical].append(context)
            
        if norm_str not in self.known_courses:
            self.known_courses[norm_str] = self.known_courses[canonical]

    def attempt_course_recovery(self, norm_str: str, malformed_cell: dict = None):
        """
        Attempts to recover a malformed course string using known evidence from the SAME PDF.
        Similarity alone is NOT enough; there must be strong structural/contextual evidence.
        """
        if not norm_str or not self.known_courses:
            return None, None
            
        # 1. Direct missing parenthesis check (Strict local structural repair)
        for append_parens in [")", "))", ")))"]:
            candidate = norm_str + append_parens
            if candidate in self.known_courses:
                # Safe to recover, this is just a truncated parenthesis
                # Extract course and group from the canonical string
                import re
                m = re.match(r'^([A-Z0-9]+)\((.*)\)$', candidate)
                if m:
                    return m.group(1), m.group(2)
                
        # 2. Contextual + Similarity Evidence Match
        best_candidate = None
        best_dist = 999
        has_strong_evidence = False
        
        malformed_teacher = malformed_cell.get("teacher") if malformed_cell else None
        malformed_room = malformed_cell.get("room") if malformed_cell else None
        malformed_day = malformed_cell.get("day") if malformed_cell else None
        
        for known_str, contexts in self.known_courses.items():
            # Skip if it's not a canonical string with parenthesis
            if '(' not in known_str:
                continue
                
            dist = levenshtein_distance(norm_str, known_str)
            if dist > 3:
                continue
                
            # Similarity is close. Now check for STRONG contextual evidence.
            # Strong evidence = same teacher, or same room, or same day.
            context_match = False
            for ctx in contexts:
                if malformed_teacher and malformed_teacher == ctx.get("teacher"):
                    context_match = True
                    break
                if malformed_room and malformed_room == ctx.get("room"):
                    context_match = True
                    break
                    
            if context_match and dist < best_dist:
                best_dist = dist
                has_strong_evidence = True
                import re
                m = re.match(r'^([A-Z0-9]+)\((.*)\)$', known_str)
                if m:
                    best_candidate = (m.group(1), m.group(2))
                
        if has_strong_evidence and best_candidate:
            return best_candidate
            
        return None, None
