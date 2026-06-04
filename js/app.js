import { analyzeDiary } from './api.js';

// ── Cell definitions ──────────────────────────────────────────────────
const CELLS = {
  '불안세포': { cls: 'anxiety',   emoji: '😰', color: '#c084fc' },
  '분노세포': { cls: 'anger',     emoji: '😤', color: '#f87171' },
  '이성세포': { cls: 'reason',    emoji: '🧠', color: '#93c5fd' },
  '회피세포': { cls: 'avoidance', emoji: '😶', color: '#94a3b8' },
  '욕망세포': { cls: 'desire',    emoji: '🔥', color: '#fdba74' },
  '사랑세포': { cls: 'love',      emoji: '💗', color: '#f9a8d4' },
};

function cell(name)  { return CELLS[name] || { cls: 'reason', emoji: '💭', color: '#93c5fd' }; }
function cellCls(name) { return cell(name).cls; }

// ── Date formatting ──────────────────────────────────────────────────
const KO_DAYS = ['일','월','화','수','목','금','토'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateLong(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const day = KO_DAYS[new Date(y, m-1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 ${day}요일`;
}

function fmtDateShort(dateStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const day = KO_DAYS[new Date(y, m-1, d).getDay()];
  return `${m}월 ${d}일 ${day}요일`;
}

// ── localStorage ─────────────────────────────────────────────────────
const STORAGE_KEY = 'cell-diary-entries';

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveEntry(entry) {
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── Screen navigation ────────────────────────────────────────────────
function showScreen(id, direction = 'forward') {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'back-in');
  });
  const el = document.getElementById(id);
  el.classList.add('active');
  if (direction === 'back') el.classList.add('back-in');
}

// ── Onboarding preview ───────────────────────────────────────────────
const PREVIEW_BUBBLES = [
  { name: '불안세포', side: 'left',  msg: '저기 얘들아… 어뜩해 어뜩해! 망했어 ( •́ㅿ•̀ )' },
  { name: '사랑세포', side: 'right', msg: '불안세포야 왜 그래? 내가 도와줄게! ( ＾◡＾)っ ♡' },
  { name: '이성세포', side: 'left',  msg: '지금 어떡하지 할 시간이 없어. 차분히 생각을 해보자.' },
];

function renderOnboarding() {
  const container = document.getElementById('onboarding-bubbles');
  container.innerHTML = '';
  PREVIEW_BUBBLES.forEach(({ name, side, msg }) => {
    const c = cell(name);
    const group = makeBubbleGroup(name, side, msg, false);
    container.appendChild(group);
  });
}

// ── Home screen ──────────────────────────────────────────────────────
function renderHome() {
  const entries = loadEntries();
  const onboarding     = document.getElementById('onboarding');
  const diaryListView  = document.getElementById('diary-list-view');
  const btnWrite       = document.getElementById('btn-write');

  if (entries.length === 0) {
    onboarding.style.display    = 'flex';
    diaryListView.style.display = 'none';
    btnWrite.textContent = '일기 쓰기';
    renderOnboarding();
  } else {
    onboarding.style.display    = 'none';
    diaryListView.style.display = 'block';
    btnWrite.textContent = '오늘의 일기 쓰기';
    renderDiaryList(entries);
  }
}

function renderDiaryList(entries) {
  const container = document.getElementById('entries-container');
  container.innerHTML = '';
  entries.forEach(entry => container.appendChild(makeEntryItem(entry)));
}

function makeEntryItem(entry) {
  const c     = entry.result?.protagonist ? cell(entry.result.protagonist.name) : null;
  const emoji = c?.emoji || '📓';
  const cls   = c?.cls   || 'reason';
  const name  = entry.result?.protagonist?.name || '';

  const el = document.createElement('div');
  el.className = 'entry-item';
  el.innerHTML = `
    <div class="entry-info">
      <div class="entry-date">${fmtDateShort(entry.date)}</div>
      <div class="entry-preview">${entry.content}</div>
      ${name ? `<div class="entry-badge">
        <div class="badge-dot av-${cls}">${emoji}</div>
        <span class="nm-${cls}" style="font-weight:600">${name}</span>
        <span style="color:rgba(255,255,255,0.35); font-size:12px">↑</span>
      </div>` : ''}
    </div>
    <span class="entry-chevron">›</span>
  `;
  el.addEventListener('click', () => openEntryDetail(entry));
  return el;
}

function openEntryDetail(entry) {
  renderEntryDetail(entry);
  showScreen('screen-entry');
}

function renderEntryDetail(entry) {
  const body = document.getElementById('entry-detail-body');
  const c = entry.result?.protagonist ? cell(entry.result.protagonist.name) : null;
  const emoji = c?.emoji || '📓';
  const cls   = c?.cls   || 'reason';
  const summary = entry.result?.summary || '';

  body.innerHTML = `
    <div class="detail-hero">
      <div class="detail-ava av-${cls}">${emoji}</div>
      <div class="detail-meta">
        <div class="detail-date">${fmtDateLong(entry.date)}</div>
        <div class="detail-summary">${summary}</div>
      </div>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-content">${entry.content}</div>
  `;
}

// ── Bubble builder ───────────────────────────────────────────────────
function makeBubbleGroup(cellName, side, message, animate = true) {
  const c = cell(cellName);
  const group = document.createElement('div');
  group.className = `bubble-group ${side}`;
  if (!animate) group.style.animation = 'none'; // static preview

  const ava = document.createElement('div');
  ava.className = `cell-ava av-${c.cls}`;
  ava.textContent = c.emoji;

  const col = document.createElement('div');
  col.className = 'bubble-col';

  const name = document.createElement('span');
  name.className = `bubble-name nm-${c.cls}`;
  name.textContent = cellName;

  const msg = document.createElement('div');
  msg.className = `bubble-msg msg-${c.cls}`;

  col.appendChild(name);
  col.appendChild(msg);
  group.appendChild(ava);
  group.appendChild(col);
  return group;
}

// ── Streaming state ──────────────────────────────────────────────────
let streamBuffer   = '';
let renderedCount  = 0;
let pendingItems   = [];
let isRendering    = false;
let typingEl       = null;
let streamDone     = false;
let currentResult  = null;
let currentContent = '';
let dialogueIndex  = 0; // for left/right alternation

function resetStream() {
  streamBuffer = ''; renderedCount = 0;
  pendingItems = []; isRendering = false;
  typingEl = null; streamDone = false;
  currentResult = null; dialogueIndex = 0;
  document.getElementById('dialogue-list').innerHTML = '';
  document.getElementById('btn-to-result').classList.remove('visible');
}

// Extract completed dialogue items from streaming buffer
function extractDialogueItems(buf) {
  const items = [];
  const di = buf.indexOf('"dialogue"');
  if (di === -1) return items;
  const ai = buf.indexOf('[', di);
  if (ai === -1) return items;

  let arrayDepth = 0, arrayEnd = -1;
  for (let j = ai; j < buf.length; j++) {
    if (buf[j] === '[') arrayDepth++;
    else if (buf[j] === ']') { arrayDepth--; if (arrayDepth === 0) { arrayEnd = j; break; } }
  }
  const limit = arrayEnd !== -1 ? arrayEnd : buf.length;

  let i = ai + 1;
  while (i < limit) {
    const start = buf.indexOf('{', i);
    if (start === -1 || start >= limit) break;
    let depth = 0, end = -1;
    for (let j = start; j < limit; j++) {
      if (buf[j] === '{') depth++;
      else if (buf[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end === -1) break;
    try {
      const obj = JSON.parse(buf.slice(start, end + 1));
      if (obj.cell && obj.message) items.push(obj);
    } catch {}
    i = end + 1;
  }
  return items;
}

function peekNextCell(idx) {
  const matches = [...streamBuffer.matchAll(/"cell"\s*:\s*"([^"]+)"/g)];
  return matches[idx]?.[1] ?? null;
}

// ── Typing indicator ──────────────────────────────────────────────────
function showTypingIndicator() {
  removeTypingIndicator();
  const nextName = peekNextCell(renderedCount);
  const nextCell = nextName ? cell(nextName) : null;
  const side     = (renderedCount % 2 === 0) ? 'left' : 'right';

  const group = document.createElement('div');
  group.className = `bubble-group ${side} typing-bubble`;

  const ava = document.createElement('div');
  ava.className = `cell-ava ${nextCell ? `av-${nextCell.cls}` : ''}`;
  ava.textContent = nextCell?.emoji || '💭';

  const col = document.createElement('div');
  col.className = 'bubble-col';
  if (side === 'right') col.style.alignItems = 'flex-end';

  const name = document.createElement('span');
  name.className = `bubble-name ${nextCell ? `nm-${nextCell.cls}` : ''}`;
  name.textContent = nextName || '…';

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  col.appendChild(name);
  col.appendChild(dots);
  group.appendChild(ava);
  group.appendChild(col);

  const list = document.getElementById('dialogue-list');
  list.appendChild(group);
  typingEl = group;
  group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeTypingIndicator() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

// ── Bubble rendering with typing animation ───────────────────────────
function addStreamBubble(item) {
  const side  = (dialogueIndex % 2 === 0) ? 'left' : 'right';
  const group = makeBubbleGroup(item.cell, side, item.message);
  const list  = document.getElementById('dialogue-list');
  list.appendChild(group);
  dialogueIndex++;
  group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return group.querySelector('.bubble-msg');
}

function typeMessage(textEl, text) {
  return new Promise(resolve => {
    let i = 0;
    const speed = text.length > 40 ? 22 : 30;
    const tick = setInterval(() => {
      if (i < text.length) { textEl.textContent += text[i++]; }
      else { clearInterval(tick); resolve(); }
    }, speed);
  });
}

async function renderNextPending() {
  if (isRendering || pendingItems.length === 0) return;
  isRendering = true;

  const item = pendingItems.shift();
  removeTypingIndicator();
  const textEl = addStreamBubble(item);
  renderedCount++;

  await typeMessage(textEl, item.message);

  const isLast = streamDone && pendingItems.length === 0;
  if (!isLast) {
    await new Promise(r => setTimeout(r, 450));
    showTypingIndicator();
    await new Promise(r => setTimeout(r, 1050));
  } else {
    await new Promise(r => setTimeout(r, 250));
  }

  isRendering = false;
  renderNextPending();
}

// ── Submit diary ─────────────────────────────────────────────────────
async function startDialogue(content, date) {
  showScreen('screen-dialogue');
  resetStream();
  showTypingIndicator();

  try {
    await analyzeDiary(content, date, {
      onDelta(text) {
        streamBuffer += text;
        const items = extractDialogueItems(streamBuffer);
        const totalQueued = renderedCount + pendingItems.length;
        items.slice(totalQueued).forEach(item => pendingItems.push(item));
        renderNextPending();
      },
      onComplete(result) {
        streamDone = true;
        currentResult = result;

        const totalQueued = renderedCount + pendingItems.length;
        result.dialogue.slice(totalQueued).forEach(item => pendingItems.push(item));

        const waitAndFinalize = () => {
          if (isRendering || pendingItems.length > 0) { setTimeout(waitAndFinalize, 100); return; }
          removeTypingIndicator();

          // Save entry
          const entry = { id: date, date, content, result };
          saveEntry(entry);
          renderHome(); // refresh home in background

          // Show summarize button
          document.getElementById('btn-to-result').classList.add('visible');
        };
        waitAndFinalize();
      },
      onError(err) {
        removeTypingIndicator();
        const list = document.getElementById('dialogue-list');
        const errEl = document.createElement('div');
        errEl.style.cssText = 'padding:32px 20px; text-align:center; color:rgba(255,255,255,0.4); font-size:14px';
        errEl.textContent = err.message;
        list.appendChild(errEl);
      },
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      removeTypingIndicator();
      const list = document.getElementById('dialogue-list');
      const errEl = document.createElement('div');
      errEl.style.cssText = 'padding:32px 20px; text-align:center; color:rgba(255,255,255,0.4); font-size:14px';
      errEl.textContent = '세포들이 잠시 혼란스러운 것 같아요. 다시 시도해주세요.';
      list.appendChild(errEl);
    }
  }
}

// ── Result tabs ──────────────────────────────────────────────────────
function renderResultScreen(result, content) {
  renderSummaryTab(result, content);
  renderDialogueTab(result.dialogue);
}

function renderSummaryTab(result, content) {
  const panel = document.getElementById('tab-summary');
  const proto  = result.protagonist;
  const c      = cell(proto.name);

  // Protagonist + diary content
  const partnerAdvice = result.advice?.[1];
  const partnerCell   = partnerAdvice ? cell(partnerAdvice.cell) : null;

  panel.innerHTML = '';

  // Section 1: protagonist + diary text
  const block1 = document.createElement('div');
  block1.className = 'summary-block';
  block1.innerHTML = `
    <div class="sum-ava av-${c.cls}">${c.emoji}</div>
    <div class="sum-body">
      <div class="sum-label">${proto.name}가 많이 움직였어요</div>
      <div class="sum-text">${escHtml(content)}</div>
    </div>
  `;
  panel.appendChild(block1);

  // Summary sentence
  if (result.summary) {
    const sentence = document.createElement('div');
    sentence.className = 'summary-sentence';
    sentence.textContent = result.summary;
    panel.appendChild(sentence);
  }

  // Divider
  const div = document.createElement('div');
  div.className = 'summary-divider';
  div.style.margin = '16px 20px';
  panel.appendChild(div);

  // Section 2: advice partner
  if (partnerAdvice && partnerCell) {
    const block2 = document.createElement('div');
    block2.className = 'summary-block';
    block2.innerHTML = `
      <div class="sum-ava av-${partnerCell.cls}">${partnerCell.emoji}</div>
      <div class="sum-body">
        <div class="sum-label">${partnerAdvice.cell}가 한마디 했어요</div>
        <div class="sum-text">${escHtml(partnerAdvice.message)}</div>
      </div>
    `;
    panel.appendChild(block2);
  }
}

function renderDialogueTab(dialogue) {
  const panel = document.getElementById('tab-dialogue');
  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'static-dialogue';
  dialogue.forEach((item, i) => {
    const side  = (i % 2 === 0) ? 'left' : 'right';
    const group = makeBubbleGroup(item.cell, side, item.message, false);
    group.querySelector('.bubble-msg').textContent = item.message;
    group.style.opacity = '1';
    wrap.appendChild(group);
  });
  panel.appendChild(wrap);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

// ── Event wiring ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Home
  renderHome();

  document.getElementById('btn-write').addEventListener('click', () => {
    document.getElementById('diary-input').value = '';
    document.getElementById('char-num').textContent = '0';
    showScreen('screen-write');
    setTimeout(() => document.getElementById('diary-input').focus(), 250);
  });

  // Write
  document.getElementById('write-back').addEventListener('click', () => {
    showScreen('screen-home', 'back');
  });

  document.getElementById('diary-input').addEventListener('input', e => {
    document.getElementById('char-num').textContent = e.target.value.length;
  });

  document.getElementById('btn-submit').addEventListener('click', () => {
    const content = document.getElementById('diary-input').value.trim();
    if (content.length < 5) return;
    currentContent = content;
    startDialogue(content, todayStr());
  });

  // Dialogue
  document.getElementById('dialogue-back').addEventListener('click', () => {
    showScreen('screen-write', 'back');
  });

  document.getElementById('btn-to-result').addEventListener('click', () => {
    if (!currentResult) return;
    renderResultScreen(currentResult, currentContent);
    showScreen('screen-result');
  });

  // Result
  document.getElementById('result-back').addEventListener('click', () => {
    showScreen('screen-home', 'back');
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Entry detail
  document.getElementById('entry-back').addEventListener('click', () => {
    showScreen('screen-home', 'back');
  });
});
