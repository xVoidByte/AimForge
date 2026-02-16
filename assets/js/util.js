export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const mean = (arr) => {
  if (!arr || arr.length === 0) return null;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
};

export const formatMs = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return '-';
  const rounded = Math.round(ms);
  return `${rounded} ms`;
};

export const formatPct = (v01) => {
  if (v01 == null || !Number.isFinite(v01)) return '0%';
  return `${Math.round(v01 * 100)}%`;
};

export const formatSeconds = (s) => {
  if (!Number.isFinite(s)) return '-';
  const clamped = Math.max(0, s);
  return clamped.toFixed(1);
};

export const safeJsonParse = (text, fallback) => {
  try {
    const v = JSON.parse(text);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

export const storage = {
  get(key, fallback = null) {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return safeJsonParse(raw, fallback);
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};