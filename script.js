(() => {
  'use strict';

  const BOARD_SIZE = 9;
  const PIECE_LABELS = {
    FU: '歩', KY: '香', KE: '桂', GI: '銀', KI: '金', KA: '角', HI: '飛', OU: '玉',
    TO: 'と', NY: '成香', NK: '成桂', NG: '成銀', UM: '馬', RY: '龍'
  };
  const KIF_TO_CODE = {
    '歩': 'FU', '香': 'KY', '桂': 'KE', '銀': 'GI', '金': 'KI', '角': 'KA', '飛': 'HI', '玉': 'OU', '王': 'OU',
    'と': 'TO', '杏': 'NY', '圭': 'NK', '全': 'NG', '馬': 'UM', '龍': 'RY', '竜': 'RY',
    '成香': 'NY', '成桂': 'NK', '成銀': 'NG', '成角': 'UM', '成飛': 'RY'
  };
  const PROMOTE_MAP = {
    FU: 'TO', KY: 'NY', KE: 'NK', GI: 'NG', KA: 'UM', HI: 'RY'
  };
  const DEMOTE_MAP = {
    TO: 'FU', NY: 'KY', NK: 'KE', NG: 'GI', UM: 'KA', RY: 'HI'
  };
  const JAPANESE_NUMBERS = { '０': 0, '〇': 0, '１': 1, '一': 1, '２': 2, '二': 2, '３': 3, '三': 3, '４': 4, '四': 4, '５': 5, '五': 5, '６': 6, '六': 6, '７': 7, '七': 7, '８': 8, '八': 8, '９': 9, '九': 9 };
  const SPECIAL_MOVES = ['投了', '中断', '千日手', '持将棋', '詰み', '切れ負け', '反則勝ち', '反則負け', '入玉勝ち'];

  const state = {
    indexData: null,
    currentFile: null,
    currentKifText: '',
    record: null,
    selectedMove: 0,
    positions: []
  };

  const elements = {
    indexStatus: document.getElementById('kifu-index-status'),
    indexRoot: document.getElementById('kifu-index'),
    error: document.getElementById('kifu-error'),
    empty: document.getElementById('kifu-empty'),
    content: document.getElementById('kifu-content'),
    metaTitle: document.getElementById('meta-title'),
    metaBlack: document.getElementById('meta-black'),
    metaWhite: document.getElementById('meta-white'),
    metaDate: document.getElementById('meta-date'),
    metaHandicap: document.getElementById('meta-handicap'),
    metaResult: document.getElementById('meta-result'),
    whiteHand: document.getElementById('white-hand'),
    blackHand: document.getElementById('black-hand'),
    board: document.getElementById('shogi-board'),
    moveList: document.getElementById('move-list'),
    moveCounter: document.getElementById('move-counter'),
    moveDescription: document.getElementById('move-description'),
    btnFirst: document.getElementById('btn-first'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnLast: document.getElementById('btn-last'),
    btnDownload: document.getElementById('btn-download')
  };

  function init() {
    setupBoardSkeleton();
    bindControls();
    bindTournamentTabs();
    loadIndex();
  }

  function setupBoardSkeleton() {
    const fragment = document.createDocumentFragment();
    for (let y = 1; y <= BOARD_SIZE; y += 1) {
      for (let x = 9; x >= 1; x -= 1) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.file = String(x);
        cell.dataset.rank = String(y);
        fragment.appendChild(cell);
      }
    }
    elements.board.appendChild(fragment);
  }

  function bindControls() {
    elements.btnFirst.addEventListener('click', () => goToMove(0));
    elements.btnPrev.addEventListener('click', () => goToMove(state.selectedMove - 1));
    elements.btnNext.addEventListener('click', () => goToMove(state.selectedMove + 1));
    elements.btnLast.addEventListener('click', () => {
      if (!state.record) return;
      goToMove(state.record.moves.length);
    });
  }

  async function loadIndex() {
    try {
      const response = await fetch('./棋譜/index.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`index.json の取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      validateIndex(data);
      state.indexData = data;
      renderIndex(data);
      elements.indexStatus.classList.add('hidden');

      const firstFile = getFirstFile(data);
      if (firstFile) {
        await loadKif(firstFile);
      } else {
        showEmpty('棋譜一覧にファイルがありません。`棋譜/index.json` を確認してください。');
      }
    } catch (error) {
      renderIndexError(error.message);
      showEmpty('棋譜一覧の読み込みに失敗しました。');
    }
  }

  function validateIndex(data) {
    if (!data || !Array.isArray(data.sections)) {
      throw new Error('index.json の形式が不正です。sections 配列が必要です。');
    }
    data.sections.forEach((section, index) => {
      if (!section || typeof section.name !== 'string' || !Array.isArray(section.files)) {
        throw new Error(`index.json の sections[${index}] が不正です。`);
      }
      section.files.forEach((file, fileIndex) => {
        if (!file || typeof file.title !== 'string' || typeof file.path !== 'string') {
          throw new Error(`index.json の sections[${index}].files[${fileIndex}] が不正です。`);
        }
      });
    });
  }

  function getFirstFile(data) {
    for (const section of data.sections) {
      if (section.files.length > 0) {
        return section.files[0];
      }
    }
    return null;
  }

  function renderIndex(data) {
    elements.indexRoot.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.sections.forEach((section) => {
      const wrap = document.createElement('section');
      wrap.className = 'kifu-index__section';

      const title = document.createElement('h4');
      title.textContent = section.name;
      wrap.appendChild(title);

      const list = document.createElement('div');
      list.className = 'kifu-index__list';

      section.files.forEach((file) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kifu-index__item';
        button.dataset.path = file.path;
        button.innerHTML = `<strong>${escapeHtml(file.title)}</strong><span class="kifu-index__path">${escapeHtml(file.path)}</span>`;
        button.addEventListener('click', () => loadKif(file));
        list.appendChild(button);
      });

      wrap.appendChild(list);
      fragment.appendChild(wrap);
    });

    elements.indexRoot.appendChild(fragment);
    updateActiveIndex();
  }

  function renderIndexError(message) {
    elements.indexStatus.textContent = message;
    elements.indexStatus.classList.remove('hidden');
    elements.indexRoot.innerHTML = '';
  }

  async function loadKif(file) {
    clearError();
    showEmpty('棋譜を読み込んでいます...');

    try {
      const response = await fetch(`./${file.path}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`棋譜ファイルの取得に失敗しました (${response.status})`);
      }
      const text = await response.text();
      const parsed = parseKif(text);
      const positions = buildPositions(parsed);

      state.currentFile = file;
      state.currentKifText = text;
      state.record = parsed;
      state.positions = positions;
      state.selectedMove = 0;

      updateActiveIndex();
      renderRecord();
      goToMove(0);
    } catch (error) {
      state.currentFile = file;
      state.currentKifText = '';
      state.record = null;
      state.positions = [];
      state.selectedMove = 0;
      updateActiveIndex();
      showError(`「${file.title}」の読み込みに失敗しました: ${error.message}`);
      showEmpty('別の棋譜を選択してください。');
    }
  }

  function parseKif(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const metadata = {
      title: '',
      black: '',
      white: '',
      startDate: '',
      handicap: '平手',
      result: ''
    };
    const moves = [];
    let moveSection = false;
    let lastDestination = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('*')) continue;

      if (!moveSection) {
        if (line.startsWith('手数----')) {
          moveSection = true;
          continue;
        }
        const metaMatch = line.match(/^([^：]+)：\s*(.+)$/);
        if (metaMatch) {
          const key = metaMatch[1].trim();
          const value = metaMatch[2].trim();
          if (key === '開始日時') metadata.startDate = value;
          else if (key === '先手') metadata.black = value;
          else if (key === '下手') metadata.black = value;
          else if (key === '後手') metadata.white = value;
          else if (key === '上手') metadata.white = value;
          else if (key === '手合割') metadata.handicap = value;
          else if (key === '棋戦') metadata.title = value;
          continue;
        }
      }

      if (moveSection) {
        const move = parseMoveLine(line, lastDestination);
        if (move) {
          moves.push(move);
          if (move.destination) {
            lastDestination = move.destination;
          }
        }
      }
    }

    if (!metadata.title) {
      metadata.title = 'VRC竜王戦 棋譜';
    }
    return { metadata, moves };
  }

  function parseMoveLine(line, lastDestination) {
    const moveMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\([^)]*\))?$/);
    if (!moveMatch) return null;

    const number = Number(moveMatch[1]);
    const raw = moveMatch[2].trim();

    if (SPECIAL_MOVES.includes(raw)) {
      return {
        number,
        raw,
        display: raw,
        special: raw,
        player: number % 2 === 1 ? 'black' : 'white',
        destination: lastDestination
      };
    }

    const parsed = parseJapaneseMove(raw, lastDestination);
    return {
      number,
      raw,
      display: raw,
      ...parsed,
      player: number % 2 === 1 ? 'black' : 'white'
    };
  }

  function parseJapaneseMove(raw, lastDestination) {
    let text = raw;
    let same = false;
    let destination;

    if (text.startsWith('同')) {
      if (!lastDestination) {
        throw new Error(`「${raw}」の移動先を判定できません。`);
      }
      same = true;
      destination = { ...lastDestination };
      text = text.replace(/^同\s*/, '').replace(/^同　*/, '');
    } else {
      const fileChar = text[0];
      const rankChar = text[1];
      if (!(fileChar in JAPANESE_NUMBERS) || !(rankChar in JAPANESE_NUMBERS)) {
        throw new Error(`「${raw}」の座標を解析できません。`);
      }
      destination = { x: JAPANESE_NUMBERS[fileChar], y: JAPANESE_NUMBERS[rankChar] };
      text = text.slice(2);
    }

    const pieceName = Object.keys(KIF_TO_CODE)
      .sort((a, b) => b.length - a.length)
      .find((name) => text.startsWith(name));

    if (!pieceName) {
      throw new Error(`「${raw}」の駒種を解析できません。`);
    }

    let rest = text.slice(pieceName.length);
    const piece = KIF_TO_CODE[pieceName];
    const promote = rest.includes('成');
    const drop = rest.includes('打');
    const fromMatch = rest.match(/\((\d)(\d)\)/);
    const from = fromMatch ? { x: Number(fromMatch[1]), y: Number(fromMatch[2]) } : null;

    return {
      same,
      destination,
      piece,
      from,
      promote,
      drop,
      special: null
    };
  }

  function buildPositions(record) {
    if (record.metadata.handicap && record.metadata.handicap !== '平手') {
      throw new Error(`現在のサンプル実装で対応している手合割は「平手」のみです。検出: ${record.metadata.handicap}`);
    }

    const positions = [];
    let current = createInitialPosition();
    positions.push(clonePosition(current));

    for (const move of record.moves) {
      current = applyMove(current, move);
      positions.push(clonePosition(current));
    }

    record.metadata.result = deriveResult(record.moves, record.metadata.black, record.metadata.white);
    return positions;
  }

  function deriveResult(moves, blackName, whiteName) {
    if (!moves.length) return '結果なし';
    const last = moves[moves.length - 1];
    if (!last.special) return '終局情報なし';

    const black = blackName || '先手';
    const white = whiteName || '後手';

    switch (last.special) {
      case '投了':
      case '切れ負け':
      case '反則負け':
        return last.player === 'black' ? `${white}の勝ち` : `${black}の勝ち`;
      case '反則勝ち':
        return last.player === 'black' ? `${black}の勝ち` : `${white}の勝ち`;
      case '千日手':
      case '持将棋':
      case '中断':
        return last.special;
      case '詰み':
      case '入玉勝ち':
        return last.player === 'black' ? `${black}の勝ち` : `${white}の勝ち`;
      default:
        return last.special;
    }
  }

  function createInitialPosition() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(null));
    const hands = { black: createEmptyHand(), white: createEmptyHand() };

    const set = (x, y, owner, code) => {
      board[y - 1][x - 1] = { owner, code };
    };

    const backRank = ['KY', 'KE', 'GI', 'KI', 'OU', 'KI', 'GI', 'KE', 'KY'];
    for (let x = 1; x <= 9; x += 1) {
      set(x, 9, 'black', backRank[x - 1]);
      set(x, 1, 'white', backRank[9 - x]);
      set(x, 7, 'black', 'FU');
      set(x, 3, 'white', 'FU');
    }
    set(2, 8, 'black', 'HI');
    set(8, 8, 'black', 'KA');
    set(8, 2, 'white', 'HI');
    set(2, 2, 'white', 'KA');

    return { board, hands };
  }

  function createEmptyHand() {
    return { FU: 0, KY: 0, KE: 0, GI: 0, KI: 0, KA: 0, HI: 0 };
  }

  function clonePosition(position) {
    return {
      board: position.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
      hands: {
        black: { ...position.hands.black },
        white: { ...position.hands.white }
      }
    };
  }

  function applyMove(position, move) {
    const next = clonePosition(position);
    if (move.special) {
      return next;
    }

    if (move.drop) {
      if (!next.hands[move.player][move.piece] || next.hands[move.player][move.piece] <= 0) {
        throw new Error(`持ち駒に ${move.piece} がありません。`);
      }
      next.hands[move.player][move.piece] -= 1;
      setPiece(next.board, move.destination.x, move.destination.y, { owner: move.player, code: move.piece });
      return next;
    }

    const source = move.from || findSourceSquare(next.board, move.player, move.piece, move.destination);
    if (!source) {
      throw new Error(`移動元を特定できません: ${move.raw}`);
    }

    const movingPiece = getPiece(next.board, source.x, source.y);
    if (!movingPiece || movingPiece.owner !== move.player) {
      throw new Error(`移動元に自分の駒がありません: ${move.raw}`);
    }

    const target = getPiece(next.board, move.destination.x, move.destination.y);
    if (target && target.owner === move.player) {
      throw new Error(`移動先に自分の駒があります: ${move.raw}`);
    }

    if (target && target.owner !== move.player) {
      const captured = demotePiece(target.code);
      if (!(captured in next.hands[move.player])) {
        throw new Error(`取得した駒 ${captured} を持ち駒に追加できません。`);
      }
      next.hands[move.player][captured] += 1;
    }

    setPiece(next.board, source.x, source.y, null);
    const finalCode = move.promote ? promotePiece(movingPiece.code) : movingPiece.code;
    setPiece(next.board, move.destination.x, move.destination.y, { owner: move.player, code: finalCode });
    return next;
  }

  function getPiece(board, x, y) {
    return board[y - 1][x - 1];
  }

  function setPiece(board, x, y, piece) {
    board[y - 1][x - 1] = piece;
  }

  function promotePiece(code) {
    return PROMOTE_MAP[code] || code;
  }

  function demotePiece(code) {
    return DEMOTE_MAP[code] || code;
  }

  function findSourceSquare(board, player, pieceCode, destination) {
    const candidates = [];
    for (let y = 1; y <= 9; y += 1) {
      for (let x = 1; x <= 9; x += 1) {
        const piece = getPiece(board, x, y);
        if (!piece || piece.owner !== player) continue;
        if (piece.code !== pieceCode && demotePiece(piece.code) !== pieceCode) continue;
        if (canMovePiece(piece.code, player, { x, y }, destination, board)) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      return candidates.sort((a, b) => Math.abs(a.x - destination.x) + Math.abs(a.y - destination.y) - (Math.abs(b.x - destination.x) + Math.abs(b.y - destination.y)))[0];
    }
    return null;
  }

  function canMovePiece(code, player, from, to, board) {
    if (from.x === to.x && from.y === to.y) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const forward = player === 'black' ? -1 : 1;
    const normDy = dy * forward;
    const normDx = dx;

    const step = (sx, sy) => normDx === sx && normDy === sy;
    const slide = (sx, sy) => {
      if (sx === 0 && sy === 0) return false;
      const steps = Math.max(Math.abs(normDx), Math.abs(normDy));
      if (normDx !== sx * steps || normDy !== sy * steps) return false;
      const dirX = dx === 0 ? 0 : dx / Math.abs(dx);
      const dirY = dy === 0 ? 0 : dy / Math.abs(dy);
      let x = from.x + dirX;
      let y = from.y + dirY;
      while (x !== to.x || y !== to.y) {
        if (getPiece(board, x, y)) return false;
        x += dirX;
        y += dirY;
      }
      return true;
    };

    switch (code) {
      case 'FU': return step(0, 1);
      case 'KY': return normDx === 0 && normDy > 0 && slide(0, 1);
      case 'KE': return (normDx === -1 || normDx === 1) && normDy === 2;
      case 'GI': return step(0, 1) || step(-1, 1) || step(1, 1) || step(-1, -1) || step(1, -1);
      case 'KI':
      case 'TO':
      case 'NY':
      case 'NK':
      case 'NG':
        return step(0, 1) || step(-1, 1) || step(1, 1) || step(-1, 0) || step(1, 0) || step(0, -1);
      case 'OU': return Math.abs(normDx) <= 1 && Math.abs(normDy) <= 1;
      case 'KA': return slide(1, 1) || slide(-1, 1) || slide(1, -1) || slide(-1, -1);
      case 'HI': return slide(1, 0) || slide(-1, 0) || slide(0, 1) || slide(0, -1);
      case 'UM': return canMovePiece('KA', player, from, to, board) || (Math.abs(normDx) + Math.abs(normDy) === 1);
      case 'RY': return canMovePiece('HI', player, from, to, board) || (Math.abs(normDx) === 1 && Math.abs(normDy) === 1);
      default: return false;
    }
  }

  function renderRecord() {
    if (!state.record || !state.currentFile) return;

    elements.empty.classList.add('hidden');
    elements.content.classList.remove('hidden');
    clearError();

    const { metadata, moves } = state.record;
    elements.metaTitle.textContent = state.currentFile.title || metadata.title || '-';
    elements.metaBlack.textContent = metadata.black || '-';
    elements.metaWhite.textContent = metadata.white || '-';
    elements.metaDate.textContent = metadata.startDate || '-';
    elements.metaHandicap.textContent = metadata.handicap || '-';
    elements.metaResult.textContent = metadata.result || '-';
    elements.btnDownload.href = `./${state.currentFile.path}`;
    elements.btnDownload.setAttribute('download', state.currentFile.path.split('/').pop() || 'record.kif');

    renderMoveList(moves);
  }

  function renderMoveList(moves) {
    elements.moveList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const initialButton = document.createElement('button');
    initialButton.type = 'button';
    initialButton.className = 'move-row';
    initialButton.innerHTML = '<span class="move-row__no">0</span><span class="move-row__text">初期局面</span>';
    initialButton.addEventListener('click', () => goToMove(0));
    fragment.appendChild(initialButton);

    moves.forEach((move, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'move-row';
      button.dataset.move = String(index + 1);
      button.innerHTML = `<span class="move-row__no">${move.number}</span><span class="move-row__text">${escapeHtml(move.display)}</span>`;
      button.addEventListener('click', () => goToMove(index + 1));
      fragment.appendChild(button);
    });

    elements.moveList.appendChild(fragment);
  }

  function goToMove(index) {
    if (!state.record || !state.positions.length) return;
    const clamped = Math.max(0, Math.min(index, state.record.moves.length));
    state.selectedMove = clamped;
    renderPosition();
    updateControls();
    updateMoveHighlight();
  }

  function renderPosition() {
    const position = state.positions[state.selectedMove];
    if (!position) return;

    const cells = elements.board.querySelectorAll('.board-cell');
    let cellIndex = 0;
    for (let y = 1; y <= 9; y += 1) {
      for (let x = 9; x >= 1; x -= 1) {
        const cell = cells[cellIndex];
        cell.innerHTML = '';
        const piece = getPiece(position.board, x, y);
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `piece ${piece.owner === 'white' ? 'piece--white' : ''}`;
          pieceEl.textContent = PIECE_LABELS[piece.code] || piece.code;
          pieceEl.title = `${piece.owner === 'black' ? '先手' : '後手'}: ${PIECE_LABELS[piece.code] || piece.code}`;
          cell.appendChild(pieceEl);
        }
        cellIndex += 1;
      }
    }

    elements.blackHand.textContent = formatHand(position.hands.black);
    elements.whiteHand.textContent = formatHand(position.hands.white);

    const totalMoves = state.record.moves.length;
    elements.moveCounter.textContent = `${state.selectedMove} / ${totalMoves} 手`;
    if (state.selectedMove === 0) {
      elements.moveDescription.textContent = '初期局面';
    } else {
      const move = state.record.moves[state.selectedMove - 1];
      elements.moveDescription.textContent = `${move.number}手目: ${move.display}`;
    }
  }

  function formatHand(hand) {
    const order = ['HI', 'KA', 'KI', 'GI', 'KE', 'KY', 'FU'];
    const result = order
      .filter((code) => hand[code] > 0)
      .map((code) => `${PIECE_LABELS[code]}${hand[code] > 1 ? hand[code] : ''}`);
    return result.length ? result.join(' ・ ') : 'なし';
  }

  function updateControls() {
    if (!state.record) return;
    const max = state.record.moves.length;
    elements.btnFirst.disabled = state.selectedMove === 0;
    elements.btnPrev.disabled = state.selectedMove === 0;
    elements.btnNext.disabled = state.selectedMove === max;
    elements.btnLast.disabled = state.selectedMove === max;
  }

  function updateMoveHighlight() {
    const rows = elements.moveList.querySelectorAll('.move-row');
    rows.forEach((row, index) => {
      row.classList.toggle('is-active', index === state.selectedMove);
    });

    const active = rows[state.selectedMove];
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function updateActiveIndex() {
    const items = elements.indexRoot.querySelectorAll('.kifu-index__item');
    items.forEach((item) => {
      item.classList.toggle('is-active', state.currentFile && item.dataset.path === state.currentFile.path);
    });
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.classList.remove('hidden');
  }

  function clearError() {
    elements.error.textContent = '';
    elements.error.classList.add('hidden');
  }

  function showEmpty(message) {
    elements.empty.textContent = message;
    elements.empty.classList.remove('hidden');
    if (!state.record) {
      elements.content.classList.add('hidden');
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bindTournamentTabs() {
    const tabs = document.querySelectorAll('[data-group-tab]');
    const panels = document.querySelectorAll('.group-panel');
  
    if (!tabs.length || !panels.length) return;
  
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.groupTab;
  
        tabs.forEach((item) => {
          const isActive = item === tab;
          item.classList.toggle('is-active', isActive);
          item.setAttribute('aria-selected', String(isActive));
        });
  
        panels.forEach((panel) => {
          const isActive = panel.id === targetId;
          panel.classList.toggle('is-active', isActive);
          panel.hidden = !isActive;
        });
      });
    });
  }

 init();

  window.addEventListener('load', () => {
    window.scrollTo(0, -2000);
  });
})();
