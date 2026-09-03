import sqlite3

def test():
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE classes (id INTEGER PRIMARY KEY, course TEXT);
        CREATE TABLE personal_overrides (
            target_class_id INTEGER,
            override_type TEXT,
            course TEXT
        );
        CREATE VIEW effective_classes AS
        SELECT 
            c.id,
            COALESCE(o.override_type, 'original') as record_type,
            COALESCE(o.course, c.course) as course
        FROM classes c
        LEFT JOIN personal_overrides o ON c.id = o.target_class_id
        
        UNION ALL
        
        SELECT -1, override_type, course FROM personal_overrides WHERE override_type = 'manually_added';
    """)
    
    conn.execute("INSERT INTO classes (id, course) VALUES (1, 'ORIGINAL')")
    conn.execute("INSERT INTO personal_overrides (target_class_id, override_type, course) VALUES (1, 'edited', 'EDITED')")
    
    rows = conn.execute("SELECT * FROM effective_classes").fetchall()
    print("Result:")
    for r in rows:
        print(r)

test()
