"""Compatibility facade: the production table reconstruction lives in parser.py.
This module exposes the parser components expected by the modular architecture.
"""
from .parser import parse_pdf
class TableParser:
    def __init__(self, semester=None): self.semester=semester
    def parse(self, pdf_path): return parse_pdf(pdf_path)
