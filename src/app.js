import {
  CHAIN_MAX,
  CHAIN_MIN,
  colorAccuracy,
  createGame,
  isAdjacent,
  mixColors,
  rgbToHex,
  scoreChain,
  shanghaiDateKey
} from './game.js';

const elements = {
  app: document.querySelector('[data-app]'),
  start: document.querySelector('[data-action="start"]'),
  reset: document.querySelector('[data-action="reset"]'),
  copy: document.querySelector('[data-action="copy"]'),
  labels: document.querySelector('[data-labels]'),
  board: document.querySelector('[data-board]'),
  target: document.querySelector('[data-target]'),
  chain: document.querySelector('[data-chain]'),
  feedback: document.querySelector('[data-feedback]'),
  round: document.querySelector('[data-round]'),
  score: document.querySelector('[data-score]'),
  best: document.querySelector('[data-best]'),
  seed: document.querySelector('[data-seed]')
};

const initialSeed = shanghaiDateKey();
const BEST_SCORE_KEY_PREFIX = 'hue-chain-rally:best:';

function bestScoreKey(seed) {
  return `${BEST_SCORE_KEY_PREFIX}${seed}`;
}

function readBestScore(seed) {
  try {
    const value = window.localStorage.getItem(bestScoreKey(seed));
    const score = Number.parseInt(value ?? '', 10);
    return Number.isInteger(score) && score >= 0 ? score : null;
  } catch {
    return null;
  }
}

function writeBestScore(seed, score) {
  try {
    window.localStorage.setItem(bestScoreKey(seed), String(score));
    return true;
  } catch {
    return false;
  }
}

const state = {
  seed: initialSeed,
  game: null,
  started: false,
  roundIndex: 0,
  selected: [],
  results: [],
  feedback: 'Start the rally, then pick 3-5 neighboring chips.',
  bestScore: readBestScore(initialSeed),
  bestStatus: '',
  showLabels: false,
  locked: false
};

function currentRound() {
  return state.game.rounds[state.roundIndex];
}

function readableColor(color) {
  const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
  return luminance > 0.58 ? '#14161b' : '#ffffff';
}

function blendPreview() {
  if (state.selected.length === 0 || !state.started) {
    return null;
  }
  return mixColors(state.selected.map((index) => currentRound().board[index]));
}

function totalScore() {
  return state.results.reduce((sum, result) => sum + result.score, 0);
}

function isFinished() {
  return state.results.length === state.game.rounds.length;
}

function hasDirectFeedback() {
  return state.feedback === 'Result copied.' || state.feedback.startsWith('Hue Chain Rally ');
}

function isCopyFallback() {
  return state.feedback.startsWith('Hue Chain Rally ');
}

function updateBestScore() {
  const score = totalScore();
  const previous = state.bestScore;

  if (previous === null || score > previous) {
    const saved = writeBestScore(state.seed, score);
    state.bestScore = score;
    state.bestStatus = previous === null
      ? 'First local best for today.'
      : `New local best by ${score - previous} points.`;

    if (!saved) {
      state.bestStatus += ' Storage is blocked, so it will reset after refresh.';
    }
    return;
  }

  state.bestStatus = score === previous
    ? "Matched today's local best."
    : `${previous - score} points short of today's local best.`;
}

function renderAnswerReveal(result) {
  const chips = result.recipeSwatches
    .map((swatch, position) => `
      <span
        class="mini-chip"
        style="--chip: ${swatch.hex}; --chip-text: ${swatch.text}"
        title="Chip ${swatch.index + 1}, ${swatch.hex}"
      >
        ${position + 1}
      </span>
    `)
    .join('');

  return `
    <div class="answer-reveal" aria-label="Hidden target chain">
      <span class="answer-title">Hidden chain</span>
      <div class="answer-row">
        <div class="chain-list answer-chips">${chips}</div>
        <span class="answer-code">${result.recipe.map((index) => index + 1).join(' -> ')}</span>
      </div>
    </div>
  `;
}

function renderTarget() {
  const round = currentRound();
  const blend = blendPreview();
  const targetHex = rgbToHex(round.target);
  const blendHex = blend ? rgbToHex(blend) : '#d7dae2';
  const accuracy = blend ? colorAccuracy(blend, round.target) : 0;

  elements.target.innerHTML = `
    <div class="swatch-block">
      <span class="swatch-label">Target</span>
      <span class="swatch" style="--swatch: ${targetHex}"></span>
      <span class="hex">${targetHex}</span>
    </div>
    <div class="swatch-block">
      <span class="swatch-label">Your mix</span>
      <span class="swatch" style="--swatch: ${blendHex}"></span>
      <span class="hex">${blend ? `${blendHex} / ${accuracy}%` : 'pick chips'}</span>
    </div>
  `;
}

function renderBoard() {
  const round = currentRound();
  elements.board.innerHTML = round.board
    .map((color, index) => {
      const selectedPosition = state.selected.indexOf(index);
      const isSelected = selectedPosition !== -1;
      const canExtend =
        state.started &&
        !state.locked &&
        state.selected.length > 0 &&
        isAdjacent(state.selected[state.selected.length - 1], index) &&
        !isSelected &&
        state.selected.length < CHAIN_MAX;
      const label = state.showLabels ? rgbToHex(color).slice(1).toUpperCase() : isSelected ? selectedPosition + 1 : '';
      const classes = ['tile', isSelected ? 'selected' : '', canExtend ? 'next' : ''].filter(Boolean).join(' ');

      return `
        <button
          class="${classes}"
          type="button"
          data-chip="${index}"
          aria-label="Chip ${index + 1}, ${rgbToHex(color)}"
          style="--chip: ${rgbToHex(color)}; --chip-text: ${readableColor(color)}"
          ${!state.started || state.locked ? 'disabled' : ''}
        >
          <span>${label}</span>
        </button>
      `;
    })
    .join('');
}

function renderChain() {
  const round = currentRound();
  const finished = isFinished();
  const chips = state.selected
    .map((index, position) => {
      const color = round.board[index];
      return `
        <span class="mini-chip" style="--chip: ${rgbToHex(color)}; --chip-text: ${readableColor(color)}">
          ${position + 1}
        </span>
      `;
    })
    .join('');

  const canSubmit = state.started && !state.locked && state.selected.length >= CHAIN_MIN;
  elements.chain.innerHTML = `
    <div class="chain-list" aria-label="Selected chain">
      ${chips || '<span class="empty-chain">No chips yet</span>'}
    </div>
    <div class="chain-actions">
      <button class="secondary" type="button" data-action="clear" ${!state.started || state.locked || state.selected.length === 0 ? 'disabled' : ''}>Clear</button>
      <button type="button" data-action="submit" ${canSubmit ? '' : 'disabled'}>Submit mix</button>
      ${state.locked && !finished ? '<button type="button" data-action="next">Next</button>' : ''}
    </div>
  `;
}

function renderFeedback() {
  const finished = isFinished();
  const last = state.results[state.results.length - 1];
  let detail = state.feedback;
  if (state.locked && last && !hasDirectFeedback()) {
    const roundSummary = finished
      ? `Rally complete: ${last.rating}, ${last.accuracy}% match, +${last.score} points.`
      : `${last.rating}: ${last.accuracy}% match, +${last.score} points.`;
    detail = finished && state.bestStatus ? `${roundSummary} ${state.bestStatus}` : roundSummary;
  }
  const detailMarkup = isCopyFallback()
    ? `<pre class="copy-fallback">${detail}</pre>`
    : `<p>${detail}</p>`;

  elements.feedback.innerHTML = `
    ${detailMarkup}
    ${state.locked && last ? renderAnswerReveal(last) : ''}
    ${finished ? `<strong>Final score: ${totalScore()} / 999</strong>` : ''}
  `;
}

function renderMeta() {
  const round = currentRound();
  const roundLabel = state.started ? `Round ${state.roundIndex + 1} of ${state.game.rounds.length}` : 'Ready';
  elements.round.textContent = `${roundLabel} - ${round.name}`;
  elements.score.textContent = `${totalScore()} pts`;
  elements.best.textContent = `Best today: ${state.bestScore === null ? 'none yet' : `${state.bestScore} pts`}`;
  elements.seed.textContent = state.seed;
  elements.app.querySelector('[data-prompt]').textContent = round.prompt;
  elements.start.textContent = state.started ? 'Restart' : 'Start rally';
  elements.copy.disabled = state.results.length !== state.game.rounds.length;
}

function render() {
  renderMeta();
  renderTarget();
  renderBoard();
  renderChain();
  renderFeedback();
}

function startGame() {
  state.game = createGame(state.seed);
  state.started = true;
  state.roundIndex = 0;
  state.selected = [];
  state.results = [];
  state.feedback = `Pick ${CHAIN_MIN}-${CHAIN_MAX} neighboring chips, then submit your mix.`;
  state.bestScore = readBestScore(state.seed);
  state.bestStatus = '';
  state.locked = false;
  render();
}

function selectChip(index) {
  if (!state.started || state.locked) {
    return;
  }

  const selectedPosition = state.selected.indexOf(index);
  if (selectedPosition !== -1 && selectedPosition === state.selected.length - 1) {
    state.selected.pop();
    state.feedback = 'Last chip removed. Keep the chain connected.';
    render();
    return;
  }

  if (selectedPosition !== -1) {
    state.feedback = 'That chip is already in the chain.';
    renderFeedback();
    return;
  }

  if (state.selected.length >= CHAIN_MAX) {
    state.feedback = `A chain can use at most ${CHAIN_MAX} chips.`;
    renderFeedback();
    return;
  }

  const last = state.selected[state.selected.length - 1];
  if (state.selected.length > 0 && !isAdjacent(last, index)) {
    state.feedback = 'Choose a chip touching the last one in your chain.';
    renderFeedback();
    return;
  }

  state.selected.push(index);
  state.feedback = state.selected.length < CHAIN_MIN
    ? `Pick ${CHAIN_MIN - state.selected.length} more chip${CHAIN_MIN - state.selected.length === 1 ? '' : 's'}.`
    : 'Ready to submit, or add another neighboring chip.';
  render();
}

function submitChain() {
  const round = currentRound();
  const result = scoreChain(round, state.selected);
  if (!result.valid) {
    state.feedback = result.reason;
    renderFeedback();
    return;
  }

  state.results.push({
    ...result,
    chain: [...state.selected],
    roundName: round.name,
    recipe: [...round.recipe],
    recipeSwatches: round.recipe.map((index) => {
      const color = round.board[index];
      return {
        index,
        hex: rgbToHex(color),
        text: readableColor(color)
      };
    })
  });
  state.locked = true;
  state.feedback = result.rating;
  if (isFinished()) {
    updateBestScore();
  }
  render();
}

function nextRound() {
  if (!state.locked) {
    return;
  }

  if (state.roundIndex === state.game.rounds.length - 1) {
    state.feedback = `Rally complete. Copy your score and challenge someone else.`;
    render();
    return;
  }

  state.roundIndex += 1;
  state.selected = [];
  state.locked = false;
  state.feedback = `New target: pick ${CHAIN_MIN}-${CHAIN_MAX} neighboring chips.`;
  render();
}

async function copyResult() {
  const lines = [
    `Hue Chain Rally ${state.seed}`,
    `Score: ${totalScore()} / 999`,
    `Best today: ${state.bestScore === null ? totalScore() : state.bestScore} / 999`,
    ...state.results.map((result, index) => {
      const answer = result.recipe.map((chip) => chip + 1).join('-');
      return `R${index + 1}: ${result.accuracy}% ${result.rating} (answer ${answer})`;
    })
  ];
  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    state.feedback = 'Result copied.';
  } catch {
    state.feedback = text;
  }
  renderFeedback();
}

elements.start.addEventListener('click', startGame);
elements.reset.addEventListener('click', () => {
  state.selected = [];
  state.feedback = `Pick ${CHAIN_MIN}-${CHAIN_MAX} neighboring chips.`;
  render();
});
elements.copy.addEventListener('click', copyResult);
elements.labels.addEventListener('change', (event) => {
  state.showLabels = event.target.checked;
  renderBoard();
});
elements.board.addEventListener('click', (event) => {
  const button = event.target.closest('[data-chip]');
  if (!button) {
    return;
  }
  selectChip(Number(button.dataset.chip));
});
elements.chain.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'clear') {
    state.selected = [];
    state.feedback = `Pick ${CHAIN_MIN}-${CHAIN_MAX} neighboring chips.`;
    render();
  }
  if (action === 'submit') {
    submitChain();
  }
  if (action === 'next') {
    nextRound();
  }
});

state.game = createGame(state.seed);
render();

window.HueChainRally = {
  getState: () => JSON.parse(JSON.stringify(state)),
  startGame,
  selectChip,
  submitChain,
  nextRound
};
