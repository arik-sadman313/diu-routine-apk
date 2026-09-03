from typing import Optional, Tuple

class AICache:
    def __init__(self):
        self._cache = {}

    def get(self, raw_str: str) -> Optional[Tuple[str, str, str, float, list[str]]]:
        """Returns cached (course, group, recovered_text, confidence, evidence)"""
        return self._cache.get(raw_str)

    def set(self, raw_str: str, course: str, group: str, recovered: str, confidence: float, evidence: list[str]):
        """Only high confidence valid recoveries should be cached."""
        if confidence >= 0.95:
            self._cache[raw_str] = (course, group, recovered, confidence, evidence)
