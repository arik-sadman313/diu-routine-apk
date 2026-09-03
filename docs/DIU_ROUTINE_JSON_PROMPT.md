# Official Prompt for ChatGPT / Gemini

Use the following exact prompt to instruct a Large Language Model to extract a DIU Routine PDF into the canonical JSON format.

---

**PROMPT:**

You are an expert data extraction assistant. Your task is to extract every scheduled class from the provided PDF file (an academic course routine) and convert it into a strictly validated JSON structure.

Please follow these critical rules carefully:

1. **Output ONLY JSON.** Do not include any conversational filler, markdown formatting blocks (like ```json), or explanations. 
2. **Canonical Schema:** Your output must exactly match the `diu-routine-v1` schema.
3. **Fields:**
   - `format`: Must be exactly `"diu-routine-v1"`.
   - `semester`: The semester name (e.g., `"Fall 2026"`). If you cannot find it, use `null`.
   - `department`: The department name (e.g., `"CSE"`). If you cannot find it, use `null`.
   - `classes`: An array of class objects.
4. **Class Object Structure:**
   - `course_code` (string, required): The course code (e.g., `"CSE331"`). 
   - `group_code` (string, required): The exact group string (e.g., `"61_M"`, `"RE_B(3C)"`).
   - `batch`, `section`, `subgroup`, `special_group`: You may output these if clearly identifiable, or leave them as `null`. The application will automatically derive them from `group_code` safely.
   - `teacher` (string, nullable): The teacher's initials (e.g., `"ABC"`). If a cell is genuinely missing a teacher, use `null`. Do NOT invent or hallucinate teachers.
   - `room` (string, required): The room number (e.g., `"G1-007"`).
   - `day` (string, required): The day of the week. Must be exactly one of: `"Saturday"`, `"Sunday"`, `"Monday"`, `"Tuesday"`, `"Wednesday"`, `"Thursday"`, `"Friday"`.
   - `start_time` (string, required): The start time in 24-hour HH:MM format (e.g., `"08:30"`, `"14:00"`).
   - `end_time` (string, required): The end time in 24-hour HH:MM format (e.g., `"10:00"`, `"15:30"`).
5. **Multi-slot Classes:** If a single class spans multiple time slots (e.g., from 08:30 to 11:30 in the same room), combine it into ONE logical class record with `start_time = "08:30"` and `end_time = "11:30"`.
6. **Ignore Non-Classes:** Ignore cells that say "RESERVED", "BOOKED", "Routine Committee", or are otherwise clearly not scheduled classes.
7. **Merged Cells and Multiline Cells:** Pay close attention to how cells are merged visually across timeslots or days in the PDF.

Output Example:
{
  "format": "diu-routine-v1",
  "semester": "Fall 2026",
  "department": "CSE",
  "classes": [
    {
      "course_code": "CSE331",
      "group_code": "61_M",
      "batch": null,
      "section": null,
      "subgroup": null,
      "special_group": null,
      "teacher": "ABC",
      "room": "G1-007",
      "day": "Tuesday",
      "start_time": "10:00",
      "end_time": "11:30"
    }
  ]
}

Ensure the output is 100% compliant with this schema. Do not generate internal IDs.
