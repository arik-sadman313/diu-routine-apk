from typing import Optional, Tuple
from .gemini_client import GeminiClient
from .ai_cache import AICache

RECOVERY_SCHEMA = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "description": "Must be one of: 'recovered', 'unresolved', 'reject'"
        },
        "course": {
            "type": "string",
            "description": "The course code, e.g., 'CSE113'"
        },
        "group": {
            "type": "string",
            "description": "The full group code including parentheses if any, e.g., 'RE_B(3C)'"
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score between 0.0 and 1.0"
        },
        "evidence": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of strings explaining what evidence from the context was used"
        },
        "reason": {
            "type": "string",
            "description": "Short explanation of the recovery logic"
        }
    },
    "required": ["status", "course", "group", "confidence", "evidence", "reason"]
}

class AIRecoveryEngine:
    def __init__(self):
        self.client = GeminiClient()
        self.cache = AICache()

    def attempt_recovery(self, raw_str: str, context: dict, evidence_catalog: list) -> Tuple[Optional[str], Optional[str], Optional[dict]]:
        """
        Calls Gemini to attempt to recover a malformed course/group string.
        Returns: (course_code, group_code, diagnostic_data)
        """
        if not self.client.is_configured():
            return None, None, None
            
        cached = self.cache.get(raw_str)
        if cached:
            course, group, recovered, confidence, evidence = cached
            diag = {
                "raw_text": raw_str,
                "recovered_text": recovered,
                "confidence": confidence,
                "evidence": evidence + ["(Served from cache)"],
                "model_used": self.client.model
            }
            return course, group, diag

        system_prompt = (
            "You are an academic routine parser recovery engine.\n"
            "Your job is to recover malformed course and group strings from a PDF extraction.\n"
            "You will be given a problematic raw text string, structural context (day, time, room), "
            "and a catalog of KNOWN VALID courses from the SAME PDF.\n"
            "You may also be given neighboring cells and other classes taught by the same teacher.\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. Do NOT invent or guess course codes or group names.\n"
            "2. If the malformed text can be confidently matched to a known valid course/group based on "
            "typos, truncation, or identical context (e.g. same teacher, same room), recover it.\n"
            "3. If the evidence is insufficient, contradictory, or completely ambiguous, you MUST reject it by returning status: 'unresolved'.\n"
            "4. Never override strong deterministic evidence.\n"
            "5. Return ONLY the requested structured JSON."
        )
        
        user_prompt = f"Malformed Raw Text: {raw_str}\n\nContext:\n"
        for k, v in context.items():
            user_prompt += f"{k}: {v}\n"
            
        user_prompt += "\nKnown Valid Catalog from Same PDF:\n"
        for ev in evidence_catalog[:50]: # Limit to avoid massive payloads
            user_prompt += f"- {ev}\n"

        result = self.client.generate_json(system_prompt, user_prompt, RECOVERY_SCHEMA)
        
        if not result or result.get("status") != "recovered":
            return None, None, None
            
        confidence = float(result.get("confidence", 0.0))
        course = result.get("course", "")
        group = result.get("group", "")
        evidence = result.get("evidence", [])
        
        if confidence < 0.80 or not course:
            return None, None, None
            
        recovered_text = f"{course}({group})"
        
        self.cache.set(raw_str, course, group, recovered_text, confidence, evidence)
        
        diag = {
            "raw_text": raw_str,
            "recovered_text": recovered_text,
            "confidence": confidence,
            "evidence": evidence,
            "model_used": self.client.model
        }
        
        return course, group, diag
