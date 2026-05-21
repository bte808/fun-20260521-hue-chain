import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  CHAIN_MAX,
  CHAIN_MIN,
  colorAccuracy,
  createGame,
  isValidChain,
  mixColors,
  rgbToHex,
  scoreChain,
  shanghaiDateKey
} from '../src/game.js';

const game = createGame('2026-05-21');

assert.equal(game.seed, '2026-05-21');
assert.equal(game.rounds.length, 3);

for (const round of game.rounds) {
  assert.equal(round.board.length, BOARD_SIZE * BOARD_SIZE);
  assert.ok(round.recipe.length >= CHAIN_MIN);
  assert.ok(round.recipe.length <= CHAIN_MAX);
  assert.ok(isValidChain(round.recipe));

  const exactBlend = mixColors(round.recipe.map((index) => round.board[index]));
  assert.deepEqual(round.target, exactBlend);
  assert.equal(colorAccuracy(exactBlend, round.target), 100);

  const score = scoreChain(round, round.recipe);
  assert.equal(score.valid, true);
  assert.ok(score.score >= 300);
  assert.equal(score.accuracy, 100);
  assert.match(rgbToHex(round.target), /^#[0-9a-f]{6}$/);
}

assert.equal(scoreChain(game.rounds[0], [0, 2, 4]).valid, false);
assert.equal(isValidChain([0, 1, 1]), false);
assert.equal(shanghaiDateKey(new Date('2026-05-20T17:00:00.000Z')), '2026-05-21');

console.log('game tests passed');
