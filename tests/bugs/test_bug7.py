import sqlite3

def check_duplicates():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # Get all effective classes
    rows = conn.execute("SELECT id, course_code, room, day, start_time FROM effective_classes WHERE routine_version_id=?", (version,)).fetchall()
    
    # Find duplicate IDs
    ids = [r[0] for r in rows]
    import collections
    dupes = [item for item, count in collections.Counter(ids).items() if count > 1]
    
    if dupes:
        print(f"Duplicate IDs found: {dupes}")
    else:
        print("No duplicate IDs found in effective_classes.")
        
check_duplicates()
