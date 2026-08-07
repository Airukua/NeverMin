export type ActivityLevel = 'info' | 'warn' | 'error';

export interface ActivityEntry {
  readonly id: string;
  readonly at: number;
  readonly level: ActivityLevel;
  readonly message: string;
}

const MAX_ENTRIES = 50;
const entries: ActivityEntry[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export function appendActivity(level: ActivityLevel, message: string): ActivityEntry {
  const entry: ActivityEntry = {
    id: `log-${Date.now()}-${seq++}`,
    at: Date.now(),
    level,
    message: message.trim() || '(kosong)'
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  notify();
  return entry;
}

export function getRecentActivity(limit = 25): ActivityEntry[] {
  const size = Math.max(1, Math.min(MAX_ENTRIES, Math.floor(limit)));
  return entries.slice(-size).reverse();
}

export function clearActivity(): void {
  entries.length = 0;
  notify();
}

export function getActivityCount(): number {
  return entries.length;
}

export function onActivityChange(listener: () => void): { dispose(): void } {
  listeners.add(listener);
  return {
    dispose() {
      listeners.delete(listener);
    }
  };
}

export function formatActivityTime(at: number): string {
  const date = new Date(at);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
