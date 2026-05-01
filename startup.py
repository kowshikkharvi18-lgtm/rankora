import os, sqlite3

DB_FILE = "pgcet_omr.db"

def check_db():
    if os.path.exists(DB_FILE):
        try:
            conn = sqlite3.connect(DB_FILE)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM questions")
            count = cur.fetchone()[0]
            conn.close()
            print(f"DB ready: {count} questions loaded")
            return True
        except Exception as e:
            print(f"DB error: {e}")
    else:
        print("WARNING: pgcet_omr.db not found!")
    return False

if __name__ == "__main__":
    check_db()
