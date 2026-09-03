import sqlite3
import collections

def check_all():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    rows = conn.execute("SELECT id FROM effective_classes WHERE routine_version_id=?", (version,)).fetchall()
    ids = [r[0] for r in rows]
    dupes = [item for item, count in collections.Counter(ids).items() if count > 1]
    
    if dupes:
        print(f"DUPLICATES FOUND IN EFFECTIVE_CLASSES! {dupes}")
    else:
        print("No duplicate IDs in effective_classes.")
        
check_all()
