import { analyzeDiary } from './api.js';

const CELLS = [
  { name: '불안세포', emoji: '😰', cssClass: 'cell-anxiety',   color: '#c084fc', kaomoji: ['( •́ㅿ•̀ )', '૮ \'• ˕ •` ა'] },
  { name: '분노세포', emoji: '😤', cssClass: 'cell-anger',     color: '#f87171', kaomoji: ['ヽ(｀⌒´)ノ', '(◟‸◞)', '( ｰ̀εｰ́ )'] },
  { name: '이성세포', emoji: '🧠', cssClass: 'cell-reason',    color: '#93c5fd', kaomoji: [] },
  { name: '회피세포', emoji: '😶', cssClass: 'cell-avoidance', color: '#94a3b8', kaomoji: [] },
  { name: '욕망세포', emoji: '🔥', cssClass: 'cell-desire',    color: '#fdba74', kaomoji: ['(ง🔥Д🔥)ง', 'ᕙ(`▽´)ᕗ'] },
  { name: '사랑세포', emoji: '💗', cssClass: 'cell-love',      color: '#f9a8d4', kaomoji: ['(,,• •,,)♥', '٩(ˊᗜˋ*)و', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧'] },
];

function appendKaomoji(message, cellName) {
  const cell = CELLS.find(c => c.name === cellName);
  if (!cell?.kaomoji.length) return message;
  const pick = cell.kaomoji[Math.floor(Math.random() * cell.kaomoji.length)];
  return `${message} ${pick}`;
}


const dateEl            = document.getElementById('date-display');
const diaryInput        = document.getElementById('diary-input');
const charCountEl       = document.getElementById('count');
const analyzeBtn        = document.getElementById('analyze-btn');
const resultEl          = document.getElementById('result');
const dialogueEl        = document.getElementById('dialogue-list');
const protagonistEl     = document.getElementById('protagonist-card');
const adviceCardEl      = document.getElementById('advice-card');
const adviceSectionEl   = document.getElementById('advice-section');
const loadingEl         = document.getElementById('loading');
const dialogueSectionEl = document.getElementById('dialogue-section');

function setDate() {
  const d = new Date();
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  dateEl.textContent = `${d.getFullYear()} · ${String(d.getMonth()+1).padStart(2,'0')} · ${String(d.getDate()).padStart(2,'0')} · ${days[d.getDay()]}`;
}
setDate();

diaryInput.addEventListener('input', () => {
  charCountEl.textContent = diaryInput.value.length;
});

// ── 스트리밍 상태 ──
let streamBuffer   = '';
let renderedCount  = 0;
let pendingItems   = [];
let isRendering    = false;
let typingEl       = null;
let streamDone     = false;

function resetStream() {
  streamBuffer = ''; renderedCount = 0;
  pendingItems = []; isRendering = false;
  typingEl = null; streamDone = false;
}

// buffer에서 완성된 dialogue 항목 추출 — dialogue 배열 범위 안에서만 탐색
function extractDialogueItems(buf) {
  const items = [];
  const di = buf.indexOf('"dialogue"');
  if (di === -1) return items;
  const ai = buf.indexOf('[', di);
  if (ai === -1) return items;

  // dialogue 배열의 닫히는 ] 위치를 추적 (아직 안 닫혔으면 buf.length까지만)
  let arrayDepth = 0;
  let arrayEnd = -1;
  for (let j = ai; j < buf.length; j++) {
    if (buf[j] === '[') arrayDepth++;
    else if (buf[j] === ']') {
      arrayDepth--;
      if (arrayDepth === 0) { arrayEnd = j; break; }
    }
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
      if (obj.cell && obj.emoji && obj.message) items.push(obj);
    } catch {}
    i = end + 1;
  }
  return items;
}

// 스트리밍 버퍼에서 다음으로 올 세포 이름을 미리 감지
function peekNextCell(idx) {
  const matches = [...streamBuffer.matchAll(/"cell"\s*:\s*"([^"]+)"/g)];
  return matches[idx]?.[1] ?? null;
}

// ── 말풍선 ──
function showTypingIndicator() {
  removeTypingIndicator();
  const nextName = peekNextCell(renderedCount);
  const nextCell = nextName ? CELLS.find(c => c.name === nextName) : null;
  const emoji    = nextCell?.emoji ?? '💭';

  typingEl = document.createElement('div');
  typingEl.className = `bubble glass typing-bubble ${nextCell?.cssClass ?? ''}`;
  typingEl.innerHTML = `
    <div class="bubble-header">
      <div class="cell-icon wobbling">${emoji}</div>
      <span class="cell-name">${nextName ?? '…'}</span>
    </div>
    <div class="typing-dots"><span></span><span></span><span></span></div>
  `;
  dialogueEl.appendChild(typingEl);
  typingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeTypingIndicator() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function addBubble(item) {
  const cell   = CELLS.find(c => c.name === item.cell) || {};
  const bubble = document.createElement('div');
  bubble.className = `bubble glass ${cell.cssClass ?? ''}`;
  bubble.innerHTML = `
    <div class="bubble-header">
      <div class="cell-icon">${item.emoji}</div>
      <span class="cell-name">${item.cell}</span>
    </div>
    <div class="bubble-text"></div>
  `;
  dialogueEl.appendChild(bubble);
  bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return bubble.querySelector('.bubble-text');
}

function typeMessage(textEl, text) {
  return new Promise(resolve => {
    let i = 0;
    const speed = text.length > 40 ? 22 : 30;
    const tick = setInterval(() => {
      if (i < text.length) {
        textEl.textContent += text[i++];
      } else {
        clearInterval(tick);
        resolve();
      }
    }, speed);
  });
}

// 버블을 순차 렌더링 — 타이핑이 끝난 후 typing indicator → 다음 버블
async function renderNextPending() {
  if (isRendering || pendingItems.length === 0) return;
  isRendering = true;

  const item = pendingItems.shift();
  item.message = appendKaomoji(item.message, item.cell);
  removeTypingIndicator();
  const textEl = addBubble(item);
  renderedCount++;

  await typeMessage(textEl, item.message);

  // 마지막 버블이면 typing indicator 없이 바로 종료
  const isLast = streamDone && pendingItems.length === 0;
  if (!isLast) {
    await new Promise(r => setTimeout(r, 500));  // 발언 끝 여운
    showTypingIndicator();
    await new Promise(r => setTimeout(r, 1100)); // 다음 세포 타이핑 중 대기
  } else {
    await new Promise(r => setTimeout(r, 300));
  }

  isRendering = false;
  renderNextPending();
}

// ── 결과 렌더링 ──
function clearResult() {
  dialogueEl.innerHTML = '';
  protagonistEl.innerHTML = '';
  adviceCardEl.innerHTML = '';
  adviceSectionEl.style.display = 'none';
  resultEl.style.display = 'none';
  dialogueSectionEl.style.display = 'none';
}


function renderProtagonist(protagonist, summary) {
  protagonistEl.className = 'glass protagonist-card';
  protagonistEl.innerHTML = `
    <div class="protagonist-emoji">${protagonist.emoji}</div>
    <div class="protagonist-label">Today's Cell</div>
    <div class="protagonist-name">${protagonist.name}</div>
    <div class="protagonist-summary">${summary}</div>
  `;
}

let ttsController = null;

async function playAdvice(advice, btn) {
  if (ttsController) {
    ttsController.abort();
    ttsController = null;
    btn.textContent = '▶ 듣기';
    btn.classList.remove('playing');
    return;
  }

  ttsController = new AbortController();
  btn.textContent = '■ 멈추기';
  btn.classList.add('playing');

  try {
    for (const item of advice) {
      if (ttsController.signal.aborted) break;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.message, cell: item.cell }),
        signal: ttsController.signal,
      });

      if (!res.ok) break;

      const blob = await res.blob();
      if (ttsController.signal.aborted) break;

      const url = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = reject;
        ttsController.signal.addEventListener('abort', () => {
          audio.pause();
          URL.revokeObjectURL(url);
          resolve();
        });
        audio.play();
      });
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error(err);
  } finally {
    ttsController = null;
    btn.textContent = '▶ 듣기';
    btn.classList.remove('playing');
  }
}

function renderAdvice(advice) {
  adviceCardEl.className = 'glass advice-card';
  const list = document.createElement('div');
  list.className = 'advice-list';
  advice.forEach((item, i) => {
    const cell = CELLS.find(c => c.name === item.cell) || {};
    const bubble = document.createElement('div');
    bubble.className = `advice-bubble ${cell.cssClass ?? ''}`;
    bubble.style.animationDelay = `${i * 0.15}s`;
    bubble.innerHTML = `
      <div class="bubble-header">
        <div class="cell-icon">${item.emoji}</div>
        <span class="cell-name">${item.cell}</span>
      </div>
      <div class="bubble-text">${item.message}</div>
    `;
    list.appendChild(bubble);
  });

  const playBtn = document.createElement('button');
  playBtn.className = 'tts-btn';
  playBtn.textContent = '▶ 듣기';
  playBtn.addEventListener('click', () => playAdvice(advice, playBtn));

  adviceCardEl.appendChild(list);
  adviceCardEl.appendChild(playBtn);
}

function renderError(msg) {
  dialogueEl.innerHTML = `<div class="error-msg">${msg}</div>`;
}

function setDone() {
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '세포들의 대화 보기 →';
}

// ── 분석 실행 ──
analyzeBtn.addEventListener('click', async () => {
  const content = diaryInput.value.trim();
  if (content.length < 10) return;

  clearResult();
  resetStream();

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '세포들이 대화 중…';
  loadingEl.style.display = 'none';
  resultEl.style.display = 'block';
  dialogueSectionEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  showTypingIndicator();

  const date = new Date().toISOString().split('T')[0];

  try {
    await analyzeDiary(content, date, {
      onDelta: (text) => {
        streamBuffer += text;
        const items = extractDialogueItems(streamBuffer);
        const totalQueued = renderedCount + pendingItems.length;
        items.slice(totalQueued).forEach(item => pendingItems.push(item));
        renderNextPending();
      },
      onComplete: (result) => {
        streamDone = true;
        // 스트리밍에서 놓친 항목 보완
        const totalQueued = renderedCount + pendingItems.length;
        result.dialogue.slice(totalQueued).forEach(item => pendingItems.push(item));

        const waitAndFinalize = () => {
          if (isRendering || pendingItems.length > 0) {
            setTimeout(waitAndFinalize, 100);
            return;
          }
          removeTypingIndicator();
          renderProtagonist(result.protagonist, result.summary);
          if (result.advice?.length) {
            renderAdvice(result.advice);
            adviceSectionEl.style.display = 'block';
          }
          setDone();
        };
        waitAndFinalize();
      },
      onError: (err) => {
        removeTypingIndicator();
        renderError(err.message);
        setDone();
      },
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      removeTypingIndicator();
      renderError('세포들이 잠시 혼란스러운 것 같아요. 다시 시도해주세요.');
      setDone();
    }
  }
});
