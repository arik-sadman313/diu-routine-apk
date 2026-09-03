from .normalization import normalize_cell as norm
from .course_parser import parse_course_and_group

# Kept for backward compatibility
parse_course = parse_course_and_group
parse_group = lambda x: (None, None, None, None) # Deprecated, not used standalone usually
