export const BOARD_SIZE = 5;
export const CHAIN_MIN = 3;
export const CHAIN_MAX = 5;

const ROUND_NAMES = [
  'Signal sunset',
  'Neon market',
  'Lagoon spark'
];

const PROMPTS = [
  'Build a warm blend without drifting too red.',
  'Find a bright street-light mix from nearby chips.',
  'Cool the target down while keeping enough glow.'
];

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let state = hashString(seed);
  return function random() {
    state += 0x6d2b79f5;
    let sample = state;
    sample = Math.imul(sample ^ (sample >>> 15), sample | 1);
    sample ^= sample + Math.imul(sample ^ (sample >>> 7), sample | 61);
    return ((sample ^ (sample >>> 14)) >>> 0) / 4294967296;
  };
}

export function hslToRgb(hue, saturation, lightness) {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

export function rgbToHex(color) {
  return `#${[color.r, color.g, color.b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function mixColors(colors) {
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b
    }),
    { r: 0, g: 0, b: 0 }
  );

  return {
    r: Math.round(total.r / colors.length),
    g: Math.round(total.g / colors.length),
    b: Math.round(total.b / colors.length)
  };
}

export function colorDistance(a, b) {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
      (a.g - b.g) ** 2 +
      (a.b - b.b) ** 2
  );
}

export function colorAccuracy(blend, target) {
  const maxDistance = Math.sqrt(3 * 255 ** 2);
  const percent = Math.max(0, 1 - colorDistance(blend, target) / maxDistance) * 100;
  return Math.round(percent * 10) / 10;
}

export function isAdjacent(a, b) {
  const ax = a % BOARD_SIZE;
  const ay = Math.floor(a / BOARD_SIZE);
  const bx = b % BOARD_SIZE;
  const by = Math.floor(b / BOARD_SIZE);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function isValidChain(chain) {
  if (!Array.isArray(chain) || chain.length < CHAIN_MIN || chain.length > CHAIN_MAX) {
    return false;
  }

  const seen = new Set(chain);
  if (seen.size !== chain.length) {
    return false;
  }

  return chain.every((index, position) => {
    const inBounds = Number.isInteger(index) && index >= 0 && index < BOARD_SIZE * BOARD_SIZE;
    return inBounds && (position === 0 || isAdjacent(chain[position - 1], index));
  });
}

function randomColor(rng, roundIndex, chipIndex) {
  const hueShift = (roundIndex * 47 + chipIndex * 19) % 360;
  const hue = (Math.floor(rng() * 360) + hueShift) % 360;
  const saturation = 0.55 + rng() * 0.33;
  const lightness = 0.38 + rng() * 0.28;
  return hslToRgb(hue, saturation, lightness);
}

function neighbors(index) {
  const candidates = [];
  const x = index % BOARD_SIZE;
  const y = Math.floor(index / BOARD_SIZE);
  if (x > 0) candidates.push(index - 1);
  if (x < BOARD_SIZE - 1) candidates.push(index + 1);
  if (y > 0) candidates.push(index - BOARD_SIZE);
  if (y < BOARD_SIZE - 1) candidates.push(index + BOARD_SIZE);
  return candidates;
}

function createPath(rng) {
  const length = CHAIN_MIN + Math.floor(rng() * (CHAIN_MAX - CHAIN_MIN + 1));
  let attempts = 0;

  while (attempts < 80) {
    attempts += 1;
    const path = [Math.floor(rng() * BOARD_SIZE * BOARD_SIZE)];

    while (path.length < length) {
      const nextOptions = neighbors(path[path.length - 1]).filter((index) => !path.includes(index));
      if (nextOptions.length === 0) {
        break;
      }
      path.push(nextOptions[Math.floor(rng() * nextOptions.length)]);
    }

    if (path.length === length) {
      return path;
    }
  }

  return [0, 1, 2];
}

function createRound(rng, roundIndex, seed) {
  const board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, chipIndex) =>
    randomColor(rng, roundIndex, chipIndex)
  );
  const recipe = createPath(rng);
  const target = mixColors(recipe.map((index) => board[index]));

  return {
    id: `${seed}-round-${roundIndex + 1}`,
    name: ROUND_NAMES[roundIndex],
    prompt: PROMPTS[roundIndex],
    board,
    target,
    recipe
  };
}

export function createGame(seed) {
  const rng = createRng(`hue-chain:${seed}`);
  return {
    seed,
    rounds: ROUND_NAMES.map((_, roundIndex) => createRound(rng, roundIndex, seed))
  };
}

export function scoreChain(round, chain) {
  if (!isValidChain(chain)) {
    return {
      valid: false,
      reason: `Pick ${CHAIN_MIN}-${CHAIN_MAX} neighboring chips without repeats.`
    };
  }

  const blend = mixColors(chain.map((index) => round.board[index]));
  const accuracy = colorAccuracy(blend, round.target);
  const score = Math.min(333, Math.round(accuracy * 3.33));

  let rating = 'Close call';
  if (accuracy >= 96) {
    rating = 'Perfect relay';
  } else if (accuracy >= 90) {
    rating = 'Sharp mix';
  } else if (accuracy >= 82) {
    rating = 'Solid blend';
  }

  return {
    valid: true,
    blend,
    accuracy,
    score,
    rating
  };
}

export function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
