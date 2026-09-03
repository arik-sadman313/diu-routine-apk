import sqlite3
import json

def test():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # Get a class
    cls = conn.execute("SELECT * FROM classes WHERE routine_version_id=? LIMIT 1", (version,)).fetchone()
    cols = [d[0] for d in conn.execute("SELECT * FROM classes LIMIT 1").description]
    c_dict = dict(zip(cols, cls))
    
    # Delete overrides
    conn.execute("DELETE FROM personal_overrides")
    conn.commit()
    
    # Check effective_classes before
    before = conn.execute("SELECT * FROM effective_classes WHERE id=?", (c_dict['id'],)).fetchall()
    print("Before:", len(before))
    
    # Insert override via API simulator
    conn.execute("DELETE FROM personal_overrides WHERE routine_version_id=? AND target_class_id=?", (version, c_dict['id']))
    conn.execute(
        """INSERT INTO personal_overrides 
           (routine_version_id, target_class_id, override_type, day, start_time, end_time, room, course_code, group_code, batch, section, subgroup, special_group, teacher)
           VALUES (?, ?, 'edited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (version, c_dict['id'], 'Monday', '10:00', '11:00', 'Room', 'Course', '', c_dict['batch'], c_dict['section'], '', '', 'T1')
    )
    conn.commit()
    
    # Check effective_classes after
    after = conn.execute("SELECT * FROM effective_classes WHERE id=?", (c_dict['id'],)).fetchall()
    print("After:", len(after))
    
    # Check all classes in effective_classes to see if the ORIGINAL is somehow there
    all_eff = conn.execute("SELECT * FROM effective_classes WHERE routine_version_id=? AND batch=? AND section=?", (version, c_dict['batch'], c_dict['section'])).fetchall()
    
    print("Total effective classes for batch/section:", len(all_eff))

test()
