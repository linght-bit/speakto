// ════════════════════════════════════════════════════
// JOURNAL.JS — Quest journal (дневник заданий)
// Открывается кнопкой 📓 в углу экрана
// ════════════════════════════════════════════════════

let journalOpen = false;
const journalTasks = [];  // [{id, text, done, level}]

function journalAdd(id, text, level) {
  if (journalTasks.find(t => t.id === id)) return;
  journalTasks.push({ id, text, done: false, level: level || 1 });
  renderJournal();
  // flash journal button to draw attention
  const btn = document.getElementById('journal-btn');
  if (btn) { btn.classList.add('pulse'); setTimeout(() => btn.classList.remove('pulse'), 2000); }
}

function journalComplete(id) {
  const t = journalTasks.find(t => t.id === id);
  if (t && !t.done) { t.done = true; renderJournal(); }
}

function toggleJournal() {
  journalOpen = !journalOpen;
  document.getElementById('journal').classList.toggle('show', journalOpen);
  renderJournal();
}

function renderJournal() {
  const el = document.getElementById('journal-list');
  if (!el) return;
  el.innerHTML = '';
  const byLevel = {};
  for (const t of journalTasks) {
    if (!byLevel[t.level]) byLevel[t.level] = [];
    byLevel[t.level].push(t);
  }
  for (const [lvl, tasks] of Object.entries(byLevel)) {
    const hdr = document.createElement('div');
    hdr.className = 'journal-level';
    hdr.textContent = lvl == 1 ? '🌾 Загон' : lvl == 2 ? '🏡 Деревня' : `Уровень ${lvl}`;
    el.appendChild(hdr);
    for (const t of tasks) {
      const row = document.createElement('div');
      row.className = 'journal-task' + (t.done ? ' done' : '');
      row.innerHTML = (t.done ? '✓ ' : '○ ') + t.text;
      el.appendChild(row);
    }
  }
}
