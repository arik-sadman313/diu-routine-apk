import sqlite3

def test_repro():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    conn.execute("DELETE FROM personal_overrides")
    conn.commit()
    
    # Get all classes for a batch/section
    c = conn.execute("SELECT id, batch, section FROM classes WHERE routine_version_id=? AND batch IS NOT NULL LIMIT 1", (version,)).fetchone()
    c_id, batch, section = c
    
    # insert an override
    conn.execute(
        "INSERT INTO personal_overrides (routine_version_id, target_class_id, override_type, batch, section) VALUES (?, ?, 'edited', ?, ?)",
        (version, c_id, batch, section)
    )
    conn.commit()
    
    # Query effective classes for this batch/section
    rows = conn.execute(
        "SELECT id, record_type FROM effective_classes WHERE routine_version_id=? AND batch=? AND section=?",
        (version, batch, section)
    ).fetchall()
    
    orig_rows = conn.execute(
        "SELECT id, 'original' FROM classes WHERE routine_version_id=? AND batch=? AND section=?",
        (version, batch, section)
    ).fetchall()
    
    print(f"Original classes count: {len(orig_rows)}")
    print(f"Effective classes count: {len(rows)}")
    
    # check if the ID is duplicated
    ids = [r[0] for r in rows]
    import collections
    dupes = [item for item, count in collections.Counter(ids).items() if count > 1]
    print(f"Duplicates: {dupes}")

test_repro()
