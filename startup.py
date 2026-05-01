import os, sqlite3, shutil

# Repo DB (read-only on Render after deploy)
REPO_DB    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pgcet_omr.db")
# Writable runtime location
RUNTIME_DB = "/tmp/pgcet_omr.db"

def prepare_db():
    # Always set the env var so app.py picks it up in the same process
    os.environ["DB_PATH"] = RUNTIME_DB

    # If runtime copy already has data, keep it
    if os.path.exists(RUNTIME_DB):
        try:
            conn  = sqlite3.connect(RUNTIME_DB)
            cur   = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM questions")
            count = cur.fetchone()[0]
            conn.close()
            if count > 0:
                print(f"[startup] Runtime DB already ready: {count} questions at {RUNTIME_DB}")
                return
        except Exception as e:
            print(f"[startup] Runtime DB check failed ({e}), will re-copy")

    # Copy from repo
    if not os.path.exists(REPO_DB):
        print(f"[startup] ERROR: {REPO_DB} not found in repo!")
        return

    shutil.copy2(REPO_DB, RUNTIME_DB)
    conn  = sqlite3.connect(RUNTIME_DB)
    cur   = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM questions")
    count = cur.fetchone()[0]
    conn.close()
    print(f"[startup] DB copied to {RUNTIME_DB}: {count} questions loaded")

prepare_db()   # run on import so gunicorn workers also get it

if __name__ == "__main__":
    prepare_db()
