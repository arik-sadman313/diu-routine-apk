import sqlite3

def test():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # Get a class
    cls = conn.execute("SELECT * FROM classes WHERE routine_version_id=? LIMIT 1", (version,)).fetchone()
    cols = [d[0] for d in conn.execute("SELECT * FROM classes LIMIT 1").description]
    c_dict = dict(zip(cols, cls))
    
    # Print all original classes for this batch/section
    print("--- ORIGINAL CLASSES in DB ---")
    orig = conn.execute("SELECT id, day, start_time, room, course_code FROM classes WHERE routine_version_id=? AND batch=? AND section=?", (version, c_dict['batch'], c_dict['section'])).fetchall()
    for o in orig:
        print(o)
        
    print("\n--- EFFECTIVE CLASSES in DB ---")
    eff = conn.execute("SELECT id, record_type, day, start_time, room, course_code FROM effective_classes WHERE routine_version_id=? AND batch=? AND section=?", (version, c_dict['batch'], c_dict['section'])).fetchall()
    for e in eff:
        print(e)

test()
