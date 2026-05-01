// ══ STATE ═════════════════════════════════════════════════════════════════════
let questions = [], answers = {}, currentIdx = 0;
let timerInterval = null, timeLeft = 7200, testSubmitted = false;
let currentMode = 'full', currentCount = 100;
let modalAction = null;

const TIPS = [
  "💡 Computer Awareness is the easiest section — attempt it first!",
  "💡 In Reasoning, eliminate wrong options to save time.",
  "💡 For Quantitative, use approximation for speed.",
  "💡 English synonyms/antonyms — think of root words.",
  "💡 GK questions are straightforward — don't overthink.",
  "💡 No negative marking — attempt every question!",
  "💡 Manage time: ~72 seconds per question in full test.",
  "💡 Mark difficult questions and come back later.",
  "💡 Read all 4 options before selecting — tricky distractors!",
  "💡 Attempt all questions — no penalty for wrong answers.",
];

const MOTIVATIONS = [
  { min: 90, msg: "🏆 Outstanding! You are exam-ready!", color: "#16a34a" },
  { min: 75, msg: "🎉 Excellent! Keep this up!", color: "#2563eb" },
  { min: 60, msg: "👍 Good job! A little more practice!", color: "#7c3aed" },
  { min: 45, msg: "📚 Getting there! Focus on weak areas.", color: "#d97706" },
  { min: 0,  msg: "💪 Don't give up! Every attempt makes you stronger!", color: "#dc2626" },
];

const MODE_CONFIG = {
  mca_full:  { label: "🎓 MCA Full Mock — Official Pattern", time: 7200, count: 80, maxMarks: 100 },
  full:      { label: "Full Mock Test",        time: 7200, count: 100, maxMarks: 100 },
  mini:      { label: "Mini Test",             time: 3600, count: 50,  maxMarks: 50  },
  quick:     { label: "Quick Test",            time: 1440, count: 20,  maxMarks: 20  },
  sprint:    { label: "Sprint",                time: 720,  count: 10,  maxMarks: 10  },
  daily:     { label: "Daily Challenge",       time: 600,  count: 10,  maxMarks: 10  },
  important: { label: "Important Questions",   time: 1200, count: 20,  maxMarks: 20  },
  pyq2025:   { label: "📄 PYQ 2025 Paper",     time: 7200, count: 100, maxMarks: 100 },
  pyq2024:   { label: "📄 PYQ 2024 Paper",     time: 7200, count: 100, maxMarks: 100 },
  pyq2023:   { label: "📄 PYQ 2023 Paper",     time: 7200, count: 100, maxMarks: 100 },
  pyq2022:   { label: "📄 PYQ 2022 Paper",     time: 7200, count: 100, maxMarks: 100 },
  model:     { label: "📝 Model Paper 2026",   time: 7200, count: 100, maxMarks: 100 },
};

// ══ SCREEN ════════════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ══ COUNTDOWN TO EXAM DATE ════════════════════════════════════════════════════
function updateExamCountdown() {
  const examDate = new Date('2026-05-24T09:00:00');
  const now = new Date();
  const diff = examDate - now;
  const daysEl = document.getElementById('cd-days');
  const hrsEl  = document.getElementById('cd-hrs');
  const minEl  = document.getElementById('cd-min');
  if (!daysEl) return;
  if (diff <= 0) {
    const strip = daysEl.closest('.countdown-wrap');
    if (strip) strip.innerHTML = '<div style="color:#fff;font-weight:700;font-size:1rem;text-align:center">📝 Exam Day! Best of luck!</div>';
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  daysEl.textContent = String(days).padStart(2,'0');
  hrsEl.textContent  = String(hrs).padStart(2,'0');
  minEl.textContent  = String(mins).padStart(2,'0');
}
updateExamCountdown();
setInterval(updateExamCountdown, 60000);

// Auto-start practice if redirected from PYQ view
document.addEventListener('DOMContentLoaded', function() {
  var params = new URLSearchParams(window.location.search);
  var practice = params.get('practice');
  var mock = params.get('mock');
  if (mock === '1') {
    setTimeout(function() { startMCAMock(); }, 400);
  } else if (practice === 'model') {
    setTimeout(function() { startModelPaper(); }, 400);
  } else if (practice === 'pyq') {
    var yr = params.get('year');
    if (yr) setTimeout(function() { startPYQ(yr); }, 400);
  }
});

// ══ START MODES ═══════════════════════════════════════════════════════════════
async function startMode(mode, count) {
  currentMode = mode;
  currentCount = count;
  await loadTest('/questions?mode=' + mode + '&count=' + count);
}

async function startMCAMock() {
  currentMode = 'mca_full';
  currentCount = 80;
  await loadTest('/mca-mock');
}

async function startDaily() {
  currentMode = 'daily';
  currentCount = 10;
  await loadTest('/daily');
}

async function startImportant() {
  currentMode = 'important';
  currentCount = 20;
  await loadTest('/important');
}

async function startPYQ(year) {
  currentMode = 'pyq' + year;
  currentCount = 100;
  await loadTest('/pyq?year=' + year);
}

async function startModelPaper() {
  currentMode = 'model';
  currentCount = 100;
  await loadTest('/model-paper');
}

// Open PYQ/Model in study view (Q&A with answers shown)
function openPYQ(year) {
  window.location.href = '/pyq-view?year=' + year + '&type=pyq';
}

function openModel() {
  window.location.href = '/pyq-view?type=model';
}

// Practice PYQ as quiz (called from pyq_view page)
function practicePYQ(year) {
  startPYQ(year);
}

async function loadTest(url) {
  // ── RESET ALL STATE ──
  testSubmitted = false;
  answers = {};
  currentIdx = 0;
  questions = [];
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  const cfg = MODE_CONFIG[currentMode] || MODE_CONFIG.full;
  timeLeft = cfg.time;

  showScreen('loading-screen');
  const tipEl = document.getElementById('loading-tip');
  if (tipEl) tipEl.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No questions found for this paper. Go to Admin panel and click Generate Questions first.');
    }
    questions = data;

    // Set timer based on actual question count (72 sec per question, min 600s)
    var autoTime = Math.max(600, questions.length * 72);
    timeLeft = Math.min(cfg.time, autoTime);

    const modeLabel = document.getElementById('exam-mode-label');
    if (modeLabel) modeLabel.textContent = cfg.label;

    buildPalette();
    renderQ(0);
    startTimer();
    showScreen('exam-screen');
  } catch (err) {
    alert('Error: ' + err.message);
    showScreen('home-screen');
  }
}

function goHome() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  testSubmitted = false;
  showScreen('home-screen');
}

// ══ TIMER ═════════════════════════════════════════════════════════════════════
function startTimer() {
  renderTimer();
  timerInterval = setInterval(function() {
    timeLeft--;
    renderTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      showToast('Time up! Submitting your test...');
      setTimeout(doSubmit, 1200);
    }
  }, 1000);
}

function renderTimer() {
  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;
  const el = document.getElementById('timer');
  if (el) el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
  const wrap = document.getElementById('timer-wrap');
  if (!wrap) return;
  wrap.className = 'bar-timer';
  if (timeLeft <= 120) wrap.classList.add('danger');
  else if (timeLeft <= 300) wrap.classList.add('warn');
}

function pad(n) { return String(n).padStart(2, '0'); }

// ══ RENDER QUESTION ═══════════════════════════════════════════════════════════
function renderQ(idx) {
  if (idx < 0 || idx >= questions.length) return;
  currentIdx = idx;
  const q = questions[idx];

  document.getElementById('q-number').textContent = 'Q ' + (idx + 1);
  document.getElementById('q-subject').textContent = q.subject || '';
  document.getElementById('q-text').textContent = q.question || '';
  document.getElementById('opt-1').textContent = q.option1 || '';
  document.getElementById('opt-2').textContent = q.option2 || '';
  document.getElementById('opt-3').textContent = q.option3 || '';
  document.getElementById('opt-4').textContent = q.option4 || '';

  // Hot tag
  const hint = document.getElementById('q-hint-tag');
  if (hint) {
    var tags = [];
    if (q.tag === 'hot') tags.push('🔥 Likely Asked');
    if (q.part === 'B' || q.marks == 2) tags.push('⭐ 2 Marks');
    hint.textContent = tags.join(' · ');
  }

  // Reset all option rows and bubbles
  for (var i = 1; i <= 4; i++) {
    var row = document.getElementById('opt-row-' + i);
    var bub = document.getElementById('bubble-' + i);
    if (row) row.classList.remove('sel');
    if (bub) bub.classList.remove('filled');
  }

  // Restore previously selected answer
  var chosen = answers[idx];
  if (chosen) {
    var selRow = document.getElementById('opt-row-' + chosen);
    var selBub = document.getElementById('bubble-' + chosen);
    if (selRow) selRow.classList.add('sel');
    if (selBub) selBub.classList.add('filled');
  }

  // Nav buttons
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  if (btnPrev) btnPrev.disabled = (idx === 0);
  if (btnNext) btnNext.disabled = (idx === questions.length - 1);

  // Progress bar
  var pct = ((idx + 1) / questions.length) * 100;
  var fill = document.getElementById('exam-progress-fill');
  if (fill) fill.style.width = pct + '%';

  updatePalette();
  updateAnsweredCount();
}

// ══ SELECT OPTION ═════════════════════════════════════════════════════════════
function selectOption(opt) {
  for (var i = 1; i <= 4; i++) {
    var row = document.getElementById('opt-row-' + i);
    var bub = document.getElementById('bubble-' + i);
    if (row) row.classList.remove('sel');
    if (bub) bub.classList.remove('filled');
  }
  var selRow = document.getElementById('opt-row-' + opt);
  var selBub = document.getElementById('bubble-' + opt);
  if (selRow) selRow.classList.add('sel');
  if (selBub) selBub.classList.add('filled');

  answers[currentIdx] = opt;
  updatePalette();
  updateAnsweredCount();

  // Auto-advance on mobile after short delay (not on last question)
  if (window.innerWidth <= 768 && currentIdx < questions.length - 1) {
    setTimeout(function() { nextQ(); }, 350);
  }
}

function clearAns() {
  for (var i = 1; i <= 4; i++) {
    var row = document.getElementById('opt-row-' + i);
    var bub = document.getElementById('bubble-' + i);
    if (row) row.classList.remove('sel');
    if (bub) bub.classList.remove('filled');
  }
  delete answers[currentIdx];
  updatePalette();
  updateAnsweredCount();
}

function nextQ() { if (currentIdx < questions.length - 1) renderQ(currentIdx + 1); }
function prevQ() { if (currentIdx > 0) renderQ(currentIdx - 1); }

function jumpToSection(startIdx) {
  renderQ(Math.min(startIdx, questions.length - 1));
  if (window.innerWidth <= 768) toggleSidebar();
}

// ══ PALETTE ═══════════════════════════════════════════════════════════════════
function buildPalette() {
  var grid = document.getElementById('palette-grid');
  if (!grid) return;
  grid.innerHTML = '';

  var isMCA = (currentMode === 'mca_full');
  var partACount = 0;
  // Count Part A questions
  if (isMCA) {
    questions.forEach(function(q) { if (q.part === 'A') partACount++; });
  }

  var shownPartB = false;
  for (var i = 0; i < questions.length; i++) {
    // Insert Part A / Part B dividers for MCA mock
    if (isMCA) {
      if (i === 0) {
        var divA = document.createElement('div');
        divA.className = 'part-divider';
        divA.textContent = 'Part A — 1 Mark Each';
        grid.appendChild(divA);
      }
      if (!shownPartB && questions[i].part === 'B') {
        shownPartB = true;
        var divB = document.createElement('div');
        divB.className = 'part-divider';
        divB.style.color = 'var(--amber)';
        divB.textContent = 'Part B — 2 Marks Each ⭐';
        grid.appendChild(divB);
      }
    }

    (function(idx) {
      var btn = document.createElement('button');
      btn.className = 'pal-btn';
      if (isMCA && questions[idx].part === 'B') btn.classList.add('part-b');
      btn.textContent = idx + 1;
      btn.id = 'pal-' + idx;
      btn.onclick = function() {
        renderQ(idx);
        if (window.innerWidth <= 768) toggleSidebar();
      };
      grid.appendChild(btn);
    })(i);
  }

  var totalEl = document.getElementById('total-count');
  if (totalEl) totalEl.textContent = questions.length;

  // Update FAB
  var fab = document.getElementById('palette-fab');
  if (fab) fab.innerHTML = '<span id="fab-count">0</span>/' + questions.length;

  // Section jump buttons
  var jumps = document.getElementById('section-jumps');
  if (!jumps) return;
  jumps.innerHTML = '<div class="sec-jumps-title">Jump to Section</div>';

  if (isMCA) {
    // For MCA mock show Part A / Part B jumps
    var partAIdx = questions.findIndex(function(q) { return q.part === 'A'; });
    var partBIdx = questions.findIndex(function(q) { return q.part === 'B'; });
    if (partAIdx >= 0) {
      var btnA = document.createElement('button');
      btnA.className = 'sec-btn';
      btnA.textContent = '📝 Part A (1 mark)';
      btnA.onclick = (function(si) { return function() { jumpToSection(si); }; })(partAIdx);
      jumps.appendChild(btnA);
    }
    if (partBIdx >= 0) {
      var btnB = document.createElement('button');
      btnB.className = 'sec-btn';
      btnB.style.color = 'var(--amber)';
      btnB.textContent = '⭐ Part B (2 marks)';
      btnB.onclick = (function(si) { return function() { jumpToSection(si); }; })(partBIdx);
      jumps.appendChild(btnB);
    }
  }

  var sections = ['Computer Awareness','English Language','General Knowledge','Analytical Reasoning','Quantitative Analysis'];
  var sectionFirstIdx = {};
  for (var j = 0; j < questions.length; j++) {
    var subj = questions[j].subject;
    if (sectionFirstIdx[subj] === undefined) sectionFirstIdx[subj] = j;
  }
  sections.forEach(function(s) {
    var startIdx = sectionFirstIdx[s];
    if (startIdx !== undefined) {
      var btn = document.createElement('button');
      btn.className = 'sec-btn';
      btn.textContent = s;
      btn.onclick = (function(si) { return function() { jumpToSection(si); }; })(startIdx);
      jumps.appendChild(btn);
    }
  });
}

function updatePalette() {
  for (var i = 0; i < questions.length; i++) {
    var btn = document.getElementById('pal-' + i);
    if (!btn) continue;
    btn.className = 'pal-btn';
    if (i === currentIdx) btn.classList.add('current');
    else if (answers[i]) btn.classList.add('answered');
  }
}

function updateAnsweredCount() {
  var n = Object.keys(answers).length;
  var el = document.getElementById('answered-count');
  if (el) el.textContent = n;
  var fab = document.getElementById('fab-count');
  if (fab) fab.textContent = n;
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  sb.classList.toggle('open');
  // Backdrop for mobile
  var bd = document.getElementById('sidebar-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'sidebar-backdrop';
    bd.className = 'sidebar-backdrop';
    bd.onclick = toggleSidebar;
    document.body.appendChild(bd);
  }
  bd.classList.toggle('show', sb.classList.contains('open'));
}

// ══ SUBMIT FLOW ═══════════════════════════════════════════════════════════════
function confirmSubmit() {
  var answered = Object.keys(answers).length;
  var total = questions.length;
  var unanswered = total - answered;
  var msg = unanswered > 0
    ? 'You answered ' + answered + '/' + total + ' questions. ' + unanswered + ' unanswered. Submit anyway?'
    : 'All ' + total + ' questions answered. Ready to submit?';
  openModal('📋', 'Submit Test?', msg, doSubmit);
}

function confirmExit() {
  openModal('⚠️', 'Exit Test?', 'Your progress will be lost. Are you sure?', function() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    testSubmitted = false;
    showScreen('home-screen');
  });
}

async function doSubmit() {
  if (testSubmitted) return;
  testSubmitted = true;
  closeModal();

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  // Build payload
  var payload = {};
  for (var i = 0; i < questions.length; i++) {
    if (answers[i]) payload[questions[i].id] = answers[i];
  }

  // If nothing answered at all — show zero score directly
  if (Object.keys(payload).length === 0) {
    showResults({ score: 0, total: questions.length, results: [], mode: currentMode });
    return;
  }

  // Show loading state on button
  var btn = document.querySelector('.btn-submit');
  if (btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }

  try {
    var res = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload, mode: currentMode })
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    var data = await res.json();
    showResults(data);
  } catch (err) {
    alert('Submit failed: ' + err.message + '\n\nMake sure the Flask server is running.');
    testSubmitted = false;
    if (btn) { btn.textContent = 'Submit Test'; btn.disabled = false; }
  }
}

// Keep old name for backward compat (timer calls this)
function submitTest() { doSubmit(); }

// ══ RESULTS ═══════════════════════════════════════════════════════════════════
function showResults(data) {
  var score = (data.score !== undefined) ? data.score : 0;
  var total = (data.total && data.total > 0) ? data.total : questions.length;
  // For MCA mock, max marks = 100 (80 questions but 2-mark Part B)
  var maxMarks = (MODE_CONFIG[currentMode] && MODE_CONFIG[currentMode].maxMarks) ? MODE_CONFIG[currentMode].maxMarks : total;
  var pct = maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0;

  var wrong = 0;
  var results = data.results || [];
  results.forEach(function(r) {
    if (r.chosen !== 0 && !r.is_correct) wrong++;
  });
  var answered = results.filter(function(r){ return r.chosen && r.chosen !== 0; }).length;
  var skipped = total - answered;
  if (skipped < 0) skipped = 0;
  var accuracy = (score + wrong) > 0 ? Math.round((score / (score + wrong)) * 100) : 0;

  // Fill score card — show actual marks scored out of max marks
  document.getElementById('res-score').textContent  = score;
  document.getElementById('res-total').textContent  = maxMarks;
  document.getElementById('res-pct').textContent    = pct + '%';
  document.getElementById('rs-correct').textContent = score;
  var lbl = document.getElementById('rs-correct-lbl');
  if (lbl) lbl.textContent = (currentMode === 'mca_full') ? '✅ Marks' : '✅ Correct';
  document.getElementById('rs-wrong').textContent   = wrong;
  document.getElementById('rs-skip').textContent    = skipped;
  document.getElementById('rs-acc').textContent     = accuracy + '%';

  // Show Part A / Part B breakdown for MCA mock
  if (currentMode === 'mca_full' && (data.part_a_score !== undefined)) {
    var paEl = document.getElementById('rs-correct');
    if (paEl) paEl.textContent = score + ' marks';
    // Inject Part A/B info into score card
    var card = document.getElementById('score-card');
    var existing = document.getElementById('part-ab-info');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = 'part-ab-info';
    div.style.cssText = 'margin-top:10px;font-size:.75rem;color:rgba(255,255,255,.6);display:flex;gap:16px;justify-content:center;';
    div.innerHTML = '<span>Part A: <strong style="color:#A5B4FC">' + (data.part_a_score||0) + '/60</strong></span>' +
                    '<span>Part B: <strong style="color:#FDA4AF">' + (data.part_b_score||0) + '/40</strong></span>';
    card.appendChild(div);
  }

  // Emoji & motivational message
  var mot = MOTIVATIONS.find(function(m) { return pct >= m.min; }) || MOTIVATIONS[MOTIVATIONS.length - 1];
  var emoji = pct >= 90 ? '🏆' : pct >= 75 ? '🎉' : pct >= 60 ? '😊' : pct >= 45 ? '📚' : '💪';
  document.getElementById('score-emoji').textContent = emoji;
  document.getElementById('score-msg').textContent   = mot.msg;

  // Score card gradient — use Rankora brand colors
  var card = document.getElementById('score-card');
  if (card) card.style.background = 'linear-gradient(135deg, #0A0A0F, ' + mot.color + ')';

  // Section breakdown
  buildSectionBreakdown(results);

  // Store for review
  window._reviewData = results;

  // Auto-show review panel
  var rp = document.getElementById('review-panel');
  if (rp) rp.style.display = 'none';

  // Reset submit button for next test
  var btn = document.querySelector('.btn-submit');
  if (btn) { btn.textContent = 'Submit Test'; btn.disabled = false; }

  showScreen('result-screen');
  // Auto-populate review after short delay
  setTimeout(function() { buildReviewList(); }, 300);
}

function buildSectionBreakdown(results) {
  var sections = ['Computer Awareness','English Language','General Knowledge','Analytical Reasoning','Quantitative Analysis'];
  var colors = ['#2563eb','#16a34a','#d97706','#7c3aed','#dc2626'];
  var isMCA = (currentMode === 'mca_full');
  var qMap = {};
  questions.forEach(function(q) { qMap[q.id] = q; });
  var sectionMap = {};
  sections.forEach(function(s) { sectionMap[s] = { correct:0, total:0, marks:0, maxMarks:0 }; });
  questions.forEach(function(q) {
    if (sectionMap[q.subject]) {
      sectionMap[q.subject].total++;
      sectionMap[q.subject].maxMarks += (parseInt(q.marks)||1);
    }
  });
  results.forEach(function(r) {
    var qObj = qMap[r.id];
    var subj = (qObj && qObj.subject) || r.subject || '';
    if (sectionMap[subj] && r.is_correct) {
      sectionMap[subj].correct++;
      sectionMap[subj].marks += (parseInt(r.marks)||(qObj&&parseInt(qObj.marks))||1);
    }
  });
  var html = '';
  if (isMCA) {
    var paC=0,paT=0,pbM=0,pbT=0;
    questions.forEach(function(q){ if(q.part==='A') paT++; else if(q.part==='B') pbT++; });
    results.forEach(function(r){ var o=qMap[r.id]; if(!o||!r.is_correct) return; if(o.part==='A') paC++; else if(o.part==='B') pbM+=2; });
    html += '<div style="display:flex;gap:8px;margin-bottom:14px;">';
    html += '<div style="flex:1;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:12px;text-align:center;">';
    html += '<div style="font-family:Sora,sans-serif;font-size:1.3rem;font-weight:800;color:#6366F1">'+paC+'/'+paT+'</div>';
    html += '<div style="font-size:.62rem;color:var(--text3);margin-top:3px;">Part A &bull; 1 mark each</div></div>';
    html += '<div style="flex:1;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px;text-align:center;">';
    html += '<div style="font-family:Sora,sans-serif;font-size:1.3rem;font-weight:800;color:#F59E0B">'+pbM+'/'+(pbT*2)+'</div>';
    html += '<div style="font-size:.62rem;color:var(--text3);margin-top:3px;">Part B &bull; 2 marks each</div></div>';
    html += '</div>';
  }
  html += '<div class="sb-title">Section-wise Performance</div>';
  var hasData = false;
  sections.forEach(function(s,i) {
    var d = sectionMap[s];
    if (!d||!d.total) return;
    hasData = true;
    var pct = Math.round((d.correct/d.total)*100);
    var sc = isMCA ? (d.marks+'/'+d.maxMarks) : (d.correct+'/'+d.total);
    html += '<div class="sb-row"><div class="sb-label">'+s+'</div><div class="sb-bar-bg"><div class="sb-bar-fill" style="width:'+pct+'%;background:'+colors[i]+'"></div></div><div class="sb-score">'+sc+'</div></div>';
  });
  if (!hasData) html += '<p style="color:var(--text3);font-size:.82rem;margin-top:8px">No section data available.</p>';
  var el = document.getElementById('section-breakdown');
  if (el) el.innerHTML = html;
}
function toggleReview() {
  var panel = document.getElementById('review-panel');
  if (!panel) return;
  if (panel.style.display !== 'none') {
    panel.style.display = 'none';
    return;
  }
  buildReviewList();
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });
}

function buildReviewList() {
  var panel = document.getElementById('review-panel');
  var list = document.getElementById('review-list');
  if (!list) return;
  list.innerHTML = '';

  var labels = ['A','B','C','D'];
  var reviewData = window._reviewData || [];

  if (reviewData.length === 0) {
    list.innerHTML = '<p style="color:var(--text3);padding:16px">No answers to review.</p>';
    if (panel) panel.style.display = 'block';
    return;
  }

  reviewData.forEach(function(r, idx) {
    var status     = r.chosen === 0 ? 'skipped' : r.is_correct ? 'correct' : 'wrong';
    var statusText = r.chosen === 0 ? '⏭ Skipped' : r.is_correct ? '✅ Correct' : '❌ Wrong';
    var sc         = r.chosen === 0 ? 's' : r.is_correct ? 'c' : 'w';

    var opts = '';
    var optArr = [r.option1, r.option2, r.option3, r.option4];
    optArr.forEach(function(o, i) {
      var cls = 'review-opt';
      if (i + 1 === r.correct) cls += ' correct-ans';
      else if (i + 1 === r.chosen && !r.is_correct) cls += ' wrong-ans';
      opts += '<div class="' + cls + '">' + labels[i] + '. ' + (o || '') + '</div>';
    });

    var explHtml = '';
    if (r.explanation && r.explanation.trim()) {
      explHtml = '<div class="review-explain"><span class="explain-icon">💡</span><strong>Explanation:</strong> ' + r.explanation + '</div>';
    }

    list.innerHTML += '<div class="review-item ' + status + '">'
      + '<div class="review-q">Q' + (idx + 1) + '. ' + (r.question || '') + '</div>'
      + '<div class="review-opts">' + opts + '</div>'
      + '<div class="review-status ' + sc + '">' + statusText + '</div>'
      + explHtml
      + '</div>';
  });
}

// ══ MODAL ═════════════════════════════════════════════════════════════════════
function openModal(icon, title, msg, onConfirm) {
  document.getElementById('modal-icon').textContent  = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent   = msg;
  modalAction = onConfirm;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  modalAction = null;
}

function modalConfirm() {
  var action = modalAction;
  closeModal();
  if (action) action();
}

// ══ TOAST ═════════════════════════════════════════════════════════════════════
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2800);
}

// ══ KEYBOARD SHORTCUTS ════════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  if (!questions.length || testSubmitted) return;
  var examScreen = document.getElementById('exam-screen');
  if (!examScreen || !examScreen.classList.contains('active')) return;
  // Don't fire if user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'ArrowRight': case 'n': case 'N': nextQ(); break;
    case 'ArrowLeft':  case 'p': case 'P': prevQ(); break;
    case '1': case 'a': case 'A': selectOption(1); break;
    case '2': case 'b': case 'B': selectOption(2); break;
    case '3': case 'c': case 'C': selectOption(3); break;
    case '4': case 'd': case 'D': selectOption(4); break;
    case 'Escape': toggleSidebar(); break;
  }
});
