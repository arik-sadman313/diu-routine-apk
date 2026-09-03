from fastapi.testclient import TestClient
from api.main import app
import sqlite3

client = TestClient(app)

def test_repro():
    conn = sqlite3.connect("data/routine.db")
    version = conn.execute("SELECT MAX(id) FROM routine_versions").fetchone()[0]
    
    # get a visible class
    c = conn.execute("SELECT id, batch, section FROM classes WHERE routine_version_id=? LIMIT 1", (version,)).fetchone()
    c_id, batch, section = c
    
    conn.execute("DELETE FROM personal_overrides")
    conn.commit()
    
    # query effective_classes directly
    print("Direct query original:")
    print(conn.execute("SELECT id, record_type, batch, section FROM effective_classes WHERE id=?", (c_id,)).fetchall())
    
    # insert an override manually
    conn.execute(
        "INSERT INTO personal_overrides (routine_version_id, target_class_id, override_type, batch, section) VALUES (?, ?, ?, ?, ?)",
        (version, c_id, 'edited', batch, section)
    )
    conn.commit()
    
    print("Direct query after override:")
    print(conn.execute("SELECT id, record_type, batch, section FROM effective_classes WHERE id=?", (c_id,)).fetchall())

test_repro()
