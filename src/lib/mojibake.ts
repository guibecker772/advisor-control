const MOJIBAKE_PATTERN = /(Ã.|Â.|�)/;

function scoreMojibake(value: string): number {
  const matches = value.match(/Ã|Â|�/g);
  return matches ? matches.length : 0;
}

function decodeLatin1AsUtf8(value: string): string {
  const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function repairMojibakeString(value: string): string {
  if (!MOJIBAKE_PATTERN.test(value)) return value;

  let candidate = value;
  let best = value;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const decoded = decodeLatin1AsUtf8(candidate);
    if (!decoded || decoded === candidate) break;
    if (decoded.includes('\u0000')) break;

    const currentScore = scoreMojibake(best);
    const decodedScore = scoreMojibake(decoded);
    if (decodedScore < currentScore) {
      best = decoded;
      candidate = decoded;
      continue;
    }
    break;
  }

  return best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function repairRecursive(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const repaired = repairMojibakeString(value);
    return { value: repaired, changed: repaired !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const repaired = repairRecursive(item);
      changed = changed || repaired.changed;
      return repaired.value;
    });
    return { value: next, changed };
  }

  if (isRecord(value)) {
    let changed = false;
    const next: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      const repaired = repairRecursive(item);
      next[key] = repaired.value;
      changed = changed || repaired.changed;
    }

    return { value: next, changed };
  }

  return { value, changed: false };
}

export function repairMojibakePayload<T>(payload: T): { value: T; changed: boolean } {
  const repaired = repairRecursive(payload);
  return {
    value: repaired.value as T,
    changed: repaired.changed,
  };
}
