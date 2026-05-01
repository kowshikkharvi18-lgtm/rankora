# Rankora — Karnataka PGCET MCA 2026 Practice App

A full-featured practice app for Karnataka PGCET MCA exam with **3,400+ questions** across all 5 sections.

## Features
- 🎓 **MCA Full Mock** — Official pattern: Part A (60×1) + Part B (20×2) = 80 questions, 100 marks
- 📋 **5 Practice Modes** — Full Mock, Mini, Quick, Sprint, Daily Challenge
- 📚 **Study Mode** — All questions with answers and explanations
- 🗓️ **23-Day Study Plan** — Topic-wise daily practice with built-in quiz
- 📊 **Section-wise Performance** — Track your progress
- 🌙 **Dark Mode** — Easy on eyes
- 📱 **PWA** — Install on phone like a native app

## Sections
- 💻 Computer Awareness (1,422 questions)
- 📐 Quantitative Analysis (605 questions)
- 🌍 General Knowledge (491 questions)
- 📖 English Language (488 questions)
- 🧠 Analytical Reasoning (422 questions)

## Run Locally
```bash
pip install flask gunicorn
python app.py
```
Open: http://localhost:5000

## Deploy to PythonAnywhere (Free)
1. Upload project to PythonAnywhere
2. Set WSGI to point to `app.py`
3. Your URL: `yourusername.pythonanywhere.com`

## Deploy to Render.com (Free)
1. Push to GitHub
2. Connect repo on render.com
3. Build: `pip install -r requirements.txt`
4. Start: `python startup.py && gunicorn app:app`

## Tech Stack
- **Backend**: Python Flask
- **Database**: SQLite (3,428 questions)
- **Frontend**: Vanilla JS, CSS3
- **Deployment**: Gunicorn WSGI

Made with ♥ by Kowshik · Rankora © 2026
