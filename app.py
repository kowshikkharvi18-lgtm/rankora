from flask import Flask, jsonify, request, render_template
import random, os
from datetime import datetime, date

app = Flask(__name__, static_folder="static", template_folder="templates")

USE_MYSQL = False
MYSQL_CONFIG = {"host":"localhost","user":"root","password":"","database":"pgcet_omr"}
# Use DB_PATH env var if set (e.g. /tmp/pgcet_omr.db on Render),
# otherwise fall back to the repo file for local dev.
DB_FILE = os.environ.get("DB_PATH", "pgcet_omr.db")

# ── DB ────────────────────────────────────────────────────────────────────────
def get_db():
    if USE_MYSQL:
        import mysql.connector
        return mysql.connector.connect(**MYSQL_CONFIG)
    import sqlite3
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def rows_to_dicts(rows, use_mysql=False):
    if use_mysql: return rows
    return [dict(r) for r in rows]

def ph(): return "%s" if USE_MYSQL else "?"
def rf(): return "RAND()" if USE_MYSQL else "RANDOM()"

def init_db():
    if USE_MYSQL: return
    import sqlite3
    c = sqlite3.connect(DB_FILE)
    cur = c.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS questions(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL, question TEXT NOT NULL UNIQUE,
        option1 TEXT NOT NULL, option2 TEXT NOT NULL,
        option3 TEXT NOT NULL, option4 TEXT NOT NULL,
        correct_option INTEGER NOT NULL, tag TEXT DEFAULT '',
        explanation TEXT DEFAULT '', year TEXT DEFAULT '',
        paper_type TEXT DEFAULT 'practice',
        difficulty TEXT DEFAULT 'easy',
        marks INTEGER DEFAULT 1)""")
    # Add difficulty and marks columns if they don't exist (migration)
    try: cur.execute("ALTER TABLE questions ADD COLUMN difficulty TEXT DEFAULT 'easy'")
    except: pass
    try: cur.execute("ALTER TABLE questions ADD COLUMN marks INTEGER DEFAULT 1")
    except: pass
    cur.execute("""CREATE TABLE IF NOT EXISTS tests(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL, total INTEGER NOT NULL,
        mode TEXT DEFAULT 'full',
        part_a_score INTEGER DEFAULT 0,
        part_b_score INTEGER DEFAULT 0)""")
    try: cur.execute("ALTER TABLE tests ADD COLUMN part_a_score INTEGER DEFAULT 0")
    except: pass
    try: cur.execute("ALTER TABLE tests ADD COLUMN part_b_score INTEGER DEFAULT 0")
    except: pass
    c.commit(); c.close()

init_db()

# ── OFFICIAL PGCET MCA 2026 PATTERN ──────────────────────────────────────────
# Part A: 60 questions × 1 mark = 60 marks
# Part B: 20 questions × 2 marks = 40 marks
# Total:  80 questions, 100 marks, 120 minutes
# Source: KEA official brochure / pw.live verified pattern

MCA_PART_A = {
    "Quantitative Analysis":                20,   # Mathematics in exam = QA in DB
    "Computer Awareness":                   15,
    "Analytical Reasoning":                 10,
    "General Knowledge":                    10,
    "English Language":                      5,
}
MCA_PART_B = {
    "Quantitative Analysis":                 7,   # Mathematics Part B
    "Computer Awareness":                    5,
    "Analytical Reasoning":                  5,
    "General Knowledge":                     3,   # includes English
}
PART_A_TOTAL = sum(MCA_PART_A.values())   # 60
PART_B_TOTAL = sum(MCA_PART_B.values())   # 20

# Legacy 5-section equal split (kept for backward compat with old modes)
SECTIONS = {
    "Computer Awareness": 20,
    "English Language": 20,
    "General Knowledge": 20,
    "Analytical Reasoning": 20,
    "Quantitative Analysis": 20
}

def fetch_questions_by_mode(mode, count=100):
    conn = get_db()
    all_q = []
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,marks"
    try:
        if mode == "mca_full":
            # Official MCA pattern: Part A (60×1) + Part B (20×2)
            cur = conn.cursor()
            if USE_MYSQL: cur = conn.cursor(dictionary=True)
            # Part A
            for subj, n in MCA_PART_A.items():
                cur.execute(f"{SEL} FROM questions WHERE subject={ph()} AND (difficulty='easy' OR difficulty IS NULL OR difficulty='') ORDER BY {rf()} LIMIT {ph()}", (subj, n))
                rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
                for r in rows: r['part'] = 'A'; r['marks'] = 1
                all_q += rows
            # Part B - harder questions
            for subj, n in MCA_PART_B.items():
                cur.execute(f"{SEL} FROM questions WHERE subject={ph()} AND difficulty='hard' ORDER BY {rf()} LIMIT {ph()}", (subj, n))
                rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
                if len(rows) < n:
                    got = [r['id'] for r in rows]
                    need = n - len(rows)
                    phs2 = ",".join([ph()]*len(got)) if got else ph()
                    if got:
                        cur.execute(f"{SEL} FROM questions WHERE subject={ph()} AND id NOT IN ({phs2}) ORDER BY {rf()} LIMIT {ph()}", [subj]+got+[need])
                    else:
                        cur.execute(f"{SEL} FROM questions WHERE subject={ph()} ORDER BY {rf()} LIMIT {ph()}", (subj, need))
                    rows += rows_to_dicts(cur.fetchall(), USE_MYSQL)
                for r in rows: r['part'] = 'B'; r['marks'] = 2
                all_q += rows
        elif mode == "full":
            for subj, n in SECTIONS.items():
                cur = conn.cursor()
                if USE_MYSQL: cur = conn.cursor(dictionary=True)
                cur.execute(f"{SEL} FROM questions WHERE subject={ph()} ORDER BY {rf()} LIMIT {ph()}", (subj, n))
                rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
                for r in rows: r['marks'] = 1  # always 1 mark in non-MCA modes
                all_q += rows
        elif mode == "daily":
            cur = conn.cursor()
            if USE_MYSQL: cur = conn.cursor(dictionary=True)
            cur.execute(f"{SEL} FROM questions WHERE tag='hot' ORDER BY {rf()} LIMIT 10")
            rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
            for r in rows: r['marks'] = 1
            all_q = rows
        else:
            per_section = max(1, count // 5)
            for subj in SECTIONS:
                cur = conn.cursor()
                if USE_MYSQL: cur = conn.cursor(dictionary=True)
                cur.execute(f"{SEL} FROM questions WHERE subject={ph()} ORDER BY {rf()} LIMIT {ph()}", (subj, per_section))
                rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
                for r in rows: r['marks'] = 1  # always 1 mark in non-MCA modes
                all_q += rows
            all_q = all_q[:count]
    finally:
        conn.close()
    random.shuffle(all_q)
    return all_q

# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.route("/")
def index(): return render_template("index.html")

@app.route("/manifest.json")
def manifest():
    from flask import send_from_directory
    return send_from_directory("static", "manifest.json", mimetype="application/manifest+json")

@app.route("/sw.js")
def service_worker():
    from flask import send_from_directory
    return send_from_directory("static", "sw.js", mimetype="application/javascript")

@app.route("/admin")
def admin(): return render_template("admin.html")

@app.route("/questions")
def get_questions():
    mode  = request.args.get("mode", "full")
    count = int(request.args.get("count", 100))
    qs = fetch_questions_by_mode(mode, count)
    return jsonify(qs)

@app.route("/mca-mock")
def mca_mock():
    """Official MCA pattern: Part A 60×1 + Part B 20×2 = 80 questions, 100 marks"""
    qs = fetch_questions_by_mode("mca_full")
    return jsonify(qs)

@app.route("/pattern")
def get_pattern():
    """Return the official MCA exam pattern info"""
    return jsonify({
        "exam": "Karnataka PGCET MCA 2026",
        "total_questions": 80,
        "total_marks": 100,
        "duration_minutes": 120,
        "no_negative_marking": True,
        "part_a": {"questions": 60, "marks_each": 1, "total_marks": 60, "sections": MCA_PART_A},
        "part_b": {"questions": 20, "marks_each": 2, "total_marks": 40, "sections": MCA_PART_B},
    })

@app.route("/study")
def study():
    return render_template("study.html")

@app.route("/plan")
def plan():
    return render_template("plan.html")

# Map each day to subject + keyword filter for practice
DAY_PRACTICE = {
    "1":  {"subject": "Computer Awareness", "keyword": "binary"},
    "2":  {"subject": "Computer Awareness", "keyword": "gate"},
    "3":  {"subject": "Computer Awareness", "keyword": "memory"},
    "4":  {"subject": "Computer Awareness", "keyword": "process"},
    "5":  {"subject": "Computer Awareness", "keyword": "network"},
    "6":  {"subject": "Computer Awareness", "keyword": "sql"},
    "7":  {"subject": "Computer Awareness", "keyword": "stack"},
    "8":  {"subject": "Computer Awareness", "keyword": ""},
    "9":  {"subject": "Quantitative Analysis", "keyword": "percent"},
    "10": {"subject": "Quantitative Analysis", "keyword": "log"},
    "11": {"subject": "Quantitative Analysis", "keyword": "sin"},
    "12": {"subject": "Quantitative Analysis", "keyword": "probability"},
    "13": {"subject": "Analytical Reasoning", "keyword": "series"},
    "14": {"subject": "Analytical Reasoning", "keyword": "coded"},
    "15": {"subject": "Analytical Reasoning", "keyword": "analogy"},
    "16": {"subject": "Quantitative Analysis", "keyword": ""},
    "17": {"subject": "English Language", "keyword": "synonym"},
    "18": {"subject": "English Language", "keyword": "correct"},
    "19": {"subject": "English Language", "keyword": "idiom"},
    "20": {"subject": "General Knowledge", "keyword": "india"},
    "21": {"subject": "General Knowledge", "keyword": ""},
    "22": {"subject": "all", "keyword": ""},
    "23": {"subject": "all", "keyword": ""},
}

@app.route("/practice-day")
def practice_day():
    day = request.args.get("day", "1")
    cfg = DAY_PRACTICE.get(day, {"subject": "Computer Awareness", "keyword": ""})
    subj = cfg["subject"]
    kw   = cfg["keyword"].lower()
    count = 20
    conn = get_db()
    # Always force marks=1 for practice-day — 2-mark questions only in MCA mock
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,1 as marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        if subj == "all":
            # Day 22/23 — return important questions (20 hot questions)
            sections = ["Computer Awareness","English Language","General Knowledge","Analytical Reasoning","Quantitative Analysis"]
            all_q = []
            for s in sections:
                cur.execute(f"{SEL} FROM questions WHERE subject={ph()} AND tag='hot' ORDER BY {rf()} LIMIT 4", (s,))
                all_q += rows_to_dicts(cur.fetchall(), USE_MYSQL)
            random.shuffle(all_q)
            return jsonify(all_q)
        elif kw:
            cur.execute(
                f"{SEL} FROM questions WHERE subject={ph()} AND LOWER(question) LIKE {ph()} ORDER BY {rf()} LIMIT {ph()}",
                (subj, f"%{kw}%", count)
            )
            qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
            # if not enough keyword matches, pad with random from same subject
            if len(qs) < count:
                got_ids = [q["id"] for q in qs]
                need = count - len(qs)
                if got_ids:
                    phs2 = ",".join([ph()]*len(got_ids))
                    cur.execute(
                        f"{SEL} FROM questions WHERE subject={ph()} AND id NOT IN ({phs2}) ORDER BY {rf()} LIMIT {ph()}",
                        [subj] + got_ids + [need]
                    )
                else:
                    cur.execute(
                        f"{SEL} FROM questions WHERE subject={ph()} ORDER BY {rf()} LIMIT {ph()}",
                        (subj, need)
                    )
                qs += rows_to_dicts(cur.fetchall(), USE_MYSQL)
        else:
            cur.execute(
                f"{SEL} FROM questions WHERE subject={ph()} ORDER BY {rf()} LIMIT {ph()}",
                (subj, count)
            )
            qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    random.shuffle(qs)
    return jsonify(qs)

@app.route("/study-data")
def study_data():
    """All questions with answers grouped by subject for study."""
    subject = request.args.get("subject", "all")
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,explanation,tag,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        if subject == "all":
            cur.execute(f"{SEL} FROM questions ORDER BY subject, id")
        else:
            cur.execute(f"{SEL} FROM questions WHERE subject={ph()} ORDER BY id", (subject,))
        qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    return jsonify(qs)

@app.route("/pyq-view")
def pyq_view():
    return render_template("pyq_view.html")

@app.route("/pyq-data")
def pyq_data():
    """Returns PYQ or model paper with correct answers for study view."""
    year = request.args.get("year", "")
    ptype = request.args.get("type", "pyq")
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,explanation,year,paper_type,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        if ptype == "model":
            cur.execute(f"{SEL} FROM questions WHERE year='model' ORDER BY subject, id")
        else:
            cur.execute(f"{SEL} FROM questions WHERE year={ph()} ORDER BY subject, id", (year,))
        qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    return jsonify(qs)

@app.route("/important")
def important_questions():
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        sections = ["Computer Awareness","English Language","General Knowledge","Analytical Reasoning","Quantitative Analysis"]
        all_q = []
        for subj in sections:
            cur.execute(f"{SEL} FROM questions WHERE subject={ph()} AND tag='hot' ORDER BY {rf()} LIMIT 4", (subj,))
            all_q += rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    for q in all_q: q['marks'] = 1  # important questions always 1 mark
    random.shuffle(all_q)
    return jsonify(all_q)

@app.route("/pyq")
def pyq():
    year = request.args.get("year", "2024")
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        cur.execute(f"{SEL} FROM questions WHERE year={ph()} ORDER BY subject, id", (year,))
        qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
        for q in qs: q['marks'] = 1  # PYQ always 1 mark per question
    finally:
        conn.close()
    random.shuffle(qs)
    return jsonify(qs)

@app.route("/model-paper")
def model_paper():
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        cur.execute(f"{SEL} FROM questions WHERE year='model' ORDER BY subject, id")
        qs = rows_to_dicts(cur.fetchall(), USE_MYSQL)
        for q in qs: q['marks'] = 1  # model paper always 1 mark
    finally:
        conn.close()
    if not qs:
        qs = fetch_questions_by_mode("full", 100)
    random.shuffle(qs)
    return jsonify(qs)

@app.route("/daily")
def daily_challenge():
    conn = get_db()
    SEL = "SELECT id,subject,question,option1,option2,option3,option4,correct_option,tag,explanation,year,paper_type,difficulty,marks"
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        today_seed = date.today().toordinal()
        cur.execute(f"{SEL} FROM questions WHERE tag='hot'")
        all_hot = rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    # Seed BEFORE shuffle so same 10 questions appear all day
    random.seed(today_seed)
    random.shuffle(all_hot)
    random.seed()  # Reset seed so other random calls are not affected
    for q in all_hot: q['marks'] = 1  # daily challenge always 1 mark
    return jsonify(all_hot[:10])

@app.route("/submit", methods=["POST"])
def submit():
    data = request.get_json() or {}
    answers = data.get("answers", {})
    mode = data.get("mode", "full")
    if not answers:
        return jsonify({"score":0,"total":0,"results":[],"mode":mode})
    ids = list(answers.keys())
    phs = ",".join([ph()]*len(ids))
    conn = get_db()
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        cur.execute(f"SELECT id,correct_option,question,option1,option2,option3,option4,explanation,subject,difficulty,marks FROM questions WHERE id IN ({phs})", [int(i) for i in ids])
        rows = rows_to_dicts(cur.fetchall(), USE_MYSQL)
        score = 0; part_a_score = 0; part_b_score = 0; results = []
        for row in rows:
            qid = str(row["id"])
            chosen = int(answers.get(qid, 0))
            correct = int(row["correct_option"])
            ok = chosen == correct
            # Determine marks: only use 2-mark for MCA mock mode, all others = 1 mark
            q_marks = 2 if (mode == 'mca_full' and int(row.get("marks") or 1) == 2) else 1
            if ok:
                score += q_marks
                if q_marks == 2: part_b_score += 2
                else: part_a_score += 1
            results.append({
                "id": row["id"],
                "question": row["question"],
                "option1": row["option1"], "option2": row["option2"],
                "option3": row["option3"], "option4": row["option4"],
                "chosen": chosen, "correct": correct, "is_correct": ok,
                "marks": q_marks,
                "explanation": row.get("explanation","") or "",
                "subject": row.get("subject","")
            })
        cur.execute(f"INSERT INTO tests(date,score,total,mode,part_a_score,part_b_score) VALUES({ph()},{ph()},{ph()},{ph()},{ph()},{ph()})",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), score, len(rows), mode, part_a_score, part_b_score))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"score":score,"total":len(rows),"max_marks":score,"part_a_score":part_a_score,"part_b_score":part_b_score,"results":results,"mode":mode})

@app.route("/ai-generate", methods=["POST"])
def ai_generate():
    return jsonify({"error": "AI generation not available in this deployment", "inserted": 0, "skipped": 0})

@app.route("/stats")
def stats():
    conn = get_db()
    try:
        cur = conn.cursor()
        if USE_MYSQL: cur = conn.cursor(dictionary=True)
        cur.execute("SELECT subject, COUNT(*) as cnt FROM questions GROUP BY subject")
        by_subject = rows_to_dicts(cur.fetchall(), USE_MYSQL)
        cur.execute("SELECT COUNT(*) as total FROM questions")
        total = dict(cur.fetchone())["total"]
        cur.execute("SELECT COUNT(*) as tests, AVG(score) as avg_score, MAX(score) as best FROM tests")
        ts = dict(cur.fetchone())
        cur.execute("SELECT mode, COUNT(*) as cnt, AVG(score) as avg FROM tests GROUP BY mode")
        by_mode = rows_to_dicts(cur.fetchall(), USE_MYSQL)
    finally:
        conn.close()
    return jsonify({"total_questions":total,"by_subject":by_subject,
        "total_tests":ts["tests"] or 0,
        "avg_score":round(float(ts["avg_score"] or 0),2),
        "best_score":ts["best"] or 0,
        "by_mode":by_mode})

if __name__ == "__main__":
    print("\n" + "="*50)
    print("  MCA PGCET Practice App")
    print("  Backend:", "MySQL" if USE_MYSQL else "SQLite")
    print("  Open:  http://localhost:5000")
    print("  Admin: http://localhost:5000/admin")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)
