import sqlite3
def test():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    classes = conn.execute("SELECT id, start_time, end_time FROM classes WHERE routine_version_id=?", (version,)).fetchall()
    
    times = set()
    for c in classes:
        times.add(f"'{c[1]}' - '{c[2]}'")
    
    for t in sorted(list(times)):
        print(t)
test()
