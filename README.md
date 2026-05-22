# Hue Chain Rally

Hue Chain Rally is a tiny static browser game where you match a target color by chaining 3-5 neighboring color chips. Each chain blends into one guess, then the game scores how close your mix lands across three quick rounds.

## What it can do

- Starts instantly in the browser with no login, API key, or build step.
- Generates a deterministic daily board from the Asia/Shanghai date.
- Lets players pick connected color chains, preview the blended color, submit a score, and move through three rounds.
- Reveals the hidden target chain after each submitted round so players can learn from the miss.
- Supports a chip-code toggle for players who want more exact color clues.
- Produces a copyable final result with per-round accuracy and answer paths for sharing, with a readable text fallback if the browser blocks clipboard access.

## Why it is useful

It is a quick color-sense warmup. Designers can use it as a playful hue-matching drill, and anyone else can play a complete round in under a minute.

## Why it is fun

The board always hides a perfect chain, but the player only sees the colors until submitting. That makes each round a small visual deduction puzzle: do you trust your eyes, add one more chip, or submit before over-mixing? The post-round reveal turns near misses into a quick "oh, that was the blend" moment.

## Inspiration

This is an original implementation inspired by the current wave of short daily web puzzles and color games, including:

- Hue: https://playhue.app/
- Huezle: https://playhuezle.com/
- Playlin daily web games: https://playlin.games/

No code, art, level data, or copy was taken from those projects.

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:5175
```

## Validate

```bash
npm test
node --check src/app.js
node --check src/game.js
```

## Core gameplay

1. Press **Start rally**.
2. Pick 3-5 adjacent chips on the board.
3. Watch the live blend preview and submit when it feels close.
4. Compare your guess with the hidden chain reveal.
5. Play three rounds and copy the final score.

## Future extensions

- Add seeded challenge links.
- Add a timed sprint mode.
- Add optional color-blind pattern overlays.
- Add local best-score storage.
