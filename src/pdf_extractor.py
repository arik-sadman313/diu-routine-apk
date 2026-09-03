from __future__ import annotations
import re
from pathlib import Path
import fitz
from .group_parser import norm

EXPECTED_X_BOUNDARIES = [17.72,74.55,153.32,210.15,266.98,345.75,402.58,459.41,538.18,595.00,651.83,730.60,787.43,844.26,923.03,979.86,1036.69,1115.46,1172.29]

class PDFExtractor:
    def __init__(self, pdf_path: str | Path, original_filename: str | None = None):
        self.pdf_path = str(pdf_path)
        self.original_filename = original_filename
        self.doc = fitz.open(self.pdf_path)
    @property
    def page_count(self): return len(self.doc)
    def extract_semester(self):
        if not self.doc: return None
        text = self.doc[0].get_text("text")
        name = self.original_filename if self.original_filename else Path(self.pdf_path).stem
        m = re.search(r"\b(Summer|Spring|Fall)[-_ ]?(\d{4})\b", name, re.I) or re.search(r"\b(Summer|Spring|Fall)[-_ ]?(\d{4})\b", text, re.I)
        return f"{m.group(1).title()} {m.group(2)}" if m else None
    def get_page_words(self, page_num):
        out=[]
        for w in self.doc[page_num-1].get_text("words"):
            text=norm(w[4])
            if text: out.append({"x0":w[0],"y0":w[1],"x1":w[2],"y1":w[3],"text":text,"block":w[5],"line":w[6],"word":w[7]})
        return out
    def get_horizontal_lines(self, page_num):
        ys=[]
        for dr in self.doc[page_num-1].get_drawings():
            for item in dr.get("items",[]):
                if item[0] != "l": continue
                (x1,y1),(x2,y2)=item[1],item[2]
                if abs(y1-y2)<0.6 and abs(x2-x1)>1000: ys.append(y1)
        return sorted(set(round(y,2) for y in ys))
    @staticmethod
    def _vertical_boundaries_from_page(page):
        xs=[]
        for dr in page.get_drawings():
            for item in dr.get("items",[]):
                if item[0] != "l": continue
                (x1,y1),(x2,y2)=item[1],item[2]
                if abs(x1-x2)<0.6 and abs(y2-y1)>10: xs.append(x1)
        vals = sorted(set(round(x, 2) for x in xs))
        if not vals:
            return []

        chosen = [vals[0]]
        for x in vals[1:]:
            if x - chosen[-1] > 2.0:
                chosen.append(x)
        
        return chosen
    def get_vertical_boundaries(self, page_num):
        return self._vertical_boundaries_from_page(self.doc[page_num-1])
    def close(self): self.doc.close()
