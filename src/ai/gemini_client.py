import os
import json
import urllib.request
from typing import Optional, Dict, Any

def get_gemini_api_key() -> Optional[str]:
    return os.environ.get("GEMINI_API_KEY")

def get_gemini_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

class GeminiClient:
    def __init__(self):
        self.api_key = get_gemini_api_key()
        self.model = get_gemini_model()
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> Optional[Dict[str, Any]]:
        """
        Calls Gemini API with structured JSON output enforcement.
        Returns the parsed JSON dict or None on failure.
        """
        if not self.is_configured():
            return None
            
        url = f"{self.base_url}?key={self.api_key}"
        
        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {"role": "user", "parts": [{"text": user_prompt}]}
            ],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
                "responseSchema": schema
            }
        }
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
                
            if "candidates" in result and result["candidates"]:
                content = result["candidates"][0].get("content", {})
                parts = content.get("parts", [])
                if parts:
                    text_response = parts[0].get("text", "")
                    return json.loads(text_response)
                    
            return None
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return None
