from __future__ import annotations
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from db.database import connect, latest_version_id


def search(conn, version_id, batch=None, section=None, course=None, teacher=None, room=None, group=None):
    clauses = ["routine_version_id = ?"]
    params = [version_id]
    for col, val in [("batch", batch), ("section", section), ("course_code", course),
                     ("teacher", teacher), ("room", room), ("group_code", group)]:
        if val is not None:
            clauses.append(f"UPPER({col}) = UPPER(?)")
            params.append(val)
    sql = "SELECT day,start_time,end_time,course_code,group_code,batch,section,subgroup,room,teacher FROM effective_classes WHERE " + " AND ".join(clauses) + " AND record_type != 'hidden' ORDER BY CASE day WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3 WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6 WHEN 'Friday' THEN 7 ELSE 99 END, start_time"
    return conn.execute(sql, params).fetchall()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="data/routine.db")
    ap.add_argument("--batch")
    ap.add_argument("--section")
    ap.add_argument("--course")
    ap.add_argument("--teacher")
    ap.add_argument("--room")
    ap.add_argument("--group")
    args = ap.parse_args()
    conn = connect(args.db)
    version = latest_version_id(conn)
    if version is None:
        raise SystemExit("No routine has been imported yet.")
    rows = search(conn, version, args.batch, args.section, args.course, args.teacher, args.room, args.group)
    print(f"Routine version: {version}\nMatches: {len(rows)}")
    for r in rows:
        print(f"{r['day']:10} {r['start_time']}-{r['end_time']}  {r['course_code']:8} {r['group_code']:14} {r['room']:24} {r['teacher']}")

if __name__ == "__main__":
    main()
