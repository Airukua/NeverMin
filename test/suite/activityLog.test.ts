import * as assert from 'assert';
import {
  appendActivity,
  clearActivity,
  formatActivityTime,
  getActivityCount,
  getRecentActivity
} from '../../src/utils/activityLog';

describe('activityLog', () => {
  beforeEach(() => {
    clearActivity();
  });

  it('menyimpan entri terbaru dan membatasi ukuran', () => {
    for (let i = 0; i < 60; i += 1) {
      appendActivity('info', `step ${i}`);
    }
    assert.ok(getActivityCount() <= 50);
    const recent = getRecentActivity(5);
    assert.strictEqual(recent.length, 5);
    assert.ok(recent[0].message.includes('step 59'));
  });

  it('formatActivityTime menghasilkan HH:MM:SS', () => {
    const stamp = formatActivityTime(Date.UTC(2026, 0, 1, 3, 4, 5));
    assert.match(stamp, /^\d{2}:\d{2}:\d{2}$/);
  });
});
