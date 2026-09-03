import re

def normalize_whitespace(text: str) -> str:
    """Normalize unicode spaces and excessive whitespace."""
    if not text:
        return ""
    # Replace non-breaking spaces and all weird spacing with a single space
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()

def normalize_cell(text: str) -> str:
    """
    Normalizes a raw PDF cell string while maintaining its structural components.
    Removes whitespace around parentheses for consistent parsing.
    """
    if not text:
        return ""
    text = normalize_whitespace(text)
    
    # Remove spacing around parentheses to normalize forms like "CSE113 ( RE_B )" -> "CSE113(RE_B)"
    text = re.sub(r'\s*\(\s*', '(', text)
    text = re.sub(r'\s*\)\s*', ')', text)
    
    # Normalize isolated dashes
    text = text.replace("–", "-")
    
    return text.strip()
