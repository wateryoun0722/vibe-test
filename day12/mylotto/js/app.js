// 오늘의 행운 번호 — 로또 번호 생성기

const MIN_NUMBER = 1;
const MAX_NUMBER = 45;
const PICK_COUNT = 6;
const MAX_FIXED = 5;
const MAX_EXCLUDED = 39;
const SET_COUNT = 5;
const MAX_RETRY = 100;
const SET_LABELS = ['A', 'B', 'C', 'D', 'E'];

const state = {
  fixed: new Set(),     // 꼭 넣을 번호 (최대 5)
  excluded: new Set(),  // 빼줄 번호 (최대 39)
  results: [],          // number[][] — 생성된 세트
};

const el = {
  fixedBoard: document.getElementById('fixedBoard'),
  excludedBoard: document.getElementById('excludedBoard'),
  fixedCount: document.getElementById('fixedCount'),
  excludedCount: document.getElementById('excludedCount'),
  resetBtn: document.getElementById('resetBtn'),
  generateBtn: document.getElementById('generateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  resultList: document.getElementById('resultList'),
  toast: document.getElementById('toast'),
  toastBody: document.getElementById('toastBody'),
};

const toast = bootstrap.Toast.getOrCreateInstance(el.toast);

// ---------- 번호판 ----------

function buildBoard(board) {
  const type = board.dataset.type;
  const label = type === 'fixed' ? '꼭 넣을 번호' : '빼줄 번호';
  const fragment = document.createDocumentFragment();

  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.number = n;
    cell.textContent = n;
    cell.setAttribute('aria-pressed', 'false');
    cell.setAttribute('aria-label', `${label} ${n}`);
    fragment.appendChild(cell);
  }
  board.appendChild(fragment);
}

function renderBoards() {
  updateBoard(el.fixedBoard, state.fixed, state.excluded);
  updateBoard(el.excludedBoard, state.excluded, state.fixed);
  el.fixedCount.textContent = `${state.fixed.size} / ${MAX_FIXED}`;
  el.excludedCount.textContent = `${state.excluded.size}개`;
}

function updateBoard(board, mine, other) {
  board.querySelectorAll('.cell').forEach((cell) => {
    const n = Number(cell.dataset.number);
    cell.setAttribute('aria-pressed', String(mine.has(n)));
    cell.disabled = other.has(n);
  });
}

function toggleNumber(type, n) {
  const set = state[type];

  if (set.has(n)) {
    set.delete(n);
  } else if (type === 'fixed' && set.size >= MAX_FIXED) {
    showToast(`꼭 넣을 번호는 ${MAX_FIXED}개까지 고를 수 있어요`);
    return;
  } else if (type === 'excluded' && set.size >= MAX_EXCLUDED) {
    showToast(`최소 ${PICK_COUNT}개 번호는 남겨둬야 해요`);
    return;
  } else {
    set.add(n);
  }
  renderBoards();
}

function handleBoardClick(event) {
  const cell = event.target.closest('.cell');
  if (!cell || cell.disabled) return;
  toggleNumber(event.currentTarget.dataset.type, Number(cell.dataset.number));
}

// ---------- 번호 생성 ----------

function randomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateSet() {
  const picked = new Set(state.fixed);
  const pool = [];

  for (let n = MIN_NUMBER; n <= MAX_NUMBER; n++) {
    if (!picked.has(n) && !state.excluded.has(n)) pool.push(n);
  }

  while (picked.size < PICK_COUNT) {
    const index = randomInt(pool.length);
    picked.add(pool.splice(index, 1)[0]);
  }
  return [...picked].sort((a, b) => a - b);
}

function generateSets() {
  const results = [];
  const seen = new Set();
  let hasDuplicate = false;

  for (let i = 0; i < SET_COUNT; i++) {
    let set = generateSet();
    let tries = 1;

    while (seen.has(set.join(',')) && tries < MAX_RETRY) {
      set = generateSet();
      tries++;
    }
    if (seen.has(set.join(','))) hasDuplicate = true;

    seen.add(set.join(','));
    results.push(set);
  }

  state.results = results;
  renderResults();

  if (hasDuplicate) {
    showToast('고를 수 있는 번호가 적어서 같은 조합이 있을 수 있어요');
  }
}

// ---------- 결과 ----------

function getBallClass(n) {
  if (n <= 10) return 'ball-y';
  if (n <= 20) return 'ball-b';
  if (n <= 30) return 'ball-p';
  if (n <= 40) return 'ball-l';
  return 'ball-m';
}

function renderResults() {
  el.resultList.innerHTML = '';

  if (state.results.length === 0) {
    el.clearBtn.hidden = true;
    el.resultList.innerHTML = `
      <div class="empty">
        <i class="bi bi-emoji-smile" aria-hidden="true"></i>
        아직 뽑은 번호가 없어요
      </div>`;
    return;
  }

  el.clearBtn.hidden = false;

  state.results.forEach((numbers, index) => {
    const row = document.createElement('div');
    row.className = 'set-row';

    const label = document.createElement('span');
    label.className = 'set-label';
    label.textContent = SET_LABELS[index];
    row.appendChild(label);

    numbers.forEach((n, i) => {
      const ball = document.createElement('span');
      ball.className = `ball ${getBallClass(n)}`;
      if (state.fixed.has(n)) ball.classList.add('is-fixed');
      ball.style.animationDelay = `${index * 60 + i * 40}ms`;
      ball.textContent = n;
      row.appendChild(ball);
    });

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-pill btn-copy';
    copyBtn.dataset.index = index;
    copyBtn.setAttribute('aria-label', `${SET_LABELS[index]}세트 복사`);
    setCopyLabel(copyBtn, false);
    row.appendChild(copyBtn);

    el.resultList.appendChild(row);
  });
}

function clearResults() {
  state.results = [];
  renderResults();
}

function resetSelection() {
  state.fixed.clear();
  state.excluded.clear();
  renderBoards();
}

// ---------- 복사 ----------

function setCopyLabel(btn, done) {
  btn.classList.toggle('is-done', done);
  btn.innerHTML = done
    ? '<i class="bi bi-check-lg" aria-hidden="true"></i> <span class="copy-text">복사됨</span>'
    : '<i class="bi bi-copy" aria-hidden="true"></i> <span class="copy-text">복사</span>';
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  textarea.remove();
  return ok;
}

async function writeClipboard(text) {
  // 클릭 직후(동기)에 먼저 시도해야 브라우저가 복사를 허용한다.
  // await 이후에는 사용자 동작으로 인정되지 않아 execCommand가 실패할 수 있다.
  if (fallbackCopy(text)) return true;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

async function copySet(index, btn) {
  const numbers = state.results[index];
  if (!numbers) return;

  const ok = await writeClipboard(numbers.join(', '));
  if (!ok) {
    showToast('복사하지 못했어요. 번호를 직접 선택해 복사해 주세요');
    return;
  }

  setCopyLabel(btn, true);
  clearTimeout(btn._timer);
  btn._timer = setTimeout(() => setCopyLabel(btn, false), 1500);
}

function handleResultClick(event) {
  const btn = event.target.closest('.btn-copy');
  if (!btn) return;
  copySet(Number(btn.dataset.index), btn);
}

// ---------- 토스트 ----------

function showToast(message) {
  el.toastBody.textContent = message;
  toast.show();
}

// ---------- 시작 ----------

function init() {
  buildBoard(el.fixedBoard);
  buildBoard(el.excludedBoard);

  el.fixedBoard.addEventListener('click', handleBoardClick);
  el.excludedBoard.addEventListener('click', handleBoardClick);
  el.generateBtn.addEventListener('click', generateSets);
  el.resetBtn.addEventListener('click', resetSelection);
  el.clearBtn.addEventListener('click', clearResults);
  el.resultList.addEventListener('click', handleResultClick);

  renderBoards();
  renderResults();
}

init();
