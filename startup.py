import os, sqlite3, shutil

# On Render (and similar platforms), the repo is read-only after deploy.
# We copy the DB to /tmp so writes (test submissions) work at runtime.
# The questions data is baked into the committed pgcet_omr.db file.

REPO_DB   = os.path.join(os.path.dirname(__file__), "pgcet_omr.db")
RUNTIME_DB = os.environ.get("DB_PATH", "/tmp/pgcet_omr.db")

def prepare_db():
    # If a writable copy already exists and has data, keep it
    if os.path.exists(RUNTIME_DB):
        try:
            conn = sqlite3.connect(RUNTIME_DB)
            cur  = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM questions")
            count = cur.fetchone()[0]
            conn.close()
            if count > 0:
                print(f"Runtime DB ready at {RUNTIME_DB}: {count} questions")
                return
        except Exception:
            pass  # corrupt or empty — fall through to copy

    # Copy from repo
    if os.path.exists(REPO_DB):
        shutil.copy2(REPO_DB, RUNTIME_DB)
        conn  = sqlite3.connect(RUNTIME_DB)
        cur   = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM questions")
        count = cur.fetchone()[0]
        conn.close()
        print(f"DB copied to {RUNTIME_DB}: {count} questions loaded")
    else:
        print("WARNING: pgcet_omr.db not found in repo — starting with empty DB")

if __name__ == "__main__":
    prepare_db()
