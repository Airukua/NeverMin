import * as assert from 'assert';
import {
  buildCouplings,
  buildGitHistoryInsightsFromCommits,
  buildOwnersFromCommits,
  GitCommitRecord,
  parseGitLogNameOnly,
  pickAliveAndFrozen,
  buildFileChurn
} from '../../src/core/git/gitHistoryInsights';

describe('gitHistoryInsights', () => {
  const now = new Date('2026-08-07T00:00:00.000Z');

  const commits: GitCommitRecord[] = [
    {
      hash: 'aaaaaaaa',
      author: 'Ada',
      date: '2026-08-01T10:00:00.000Z',
      subject: 'wire trainer loop',
      files: ['src/train.py', 'src/config.py']
    },
    {
      hash: 'bbbbbbbb',
      author: 'Ada',
      date: '2026-07-20T10:00:00.000Z',
      subject: 'fix scheduler',
      files: ['src/train.py', 'src/config.py', 'src/sched.py']
    },
    {
      hash: 'cccccccc',
      author: 'Bob',
      date: '2026-07-15T10:00:00.000Z',
      subject: 'docs',
      files: ['src/train.py', 'README.md']
    },
    {
      hash: 'dddddddd',
      author: 'Ada',
      date: '2025-12-01T10:00:00.000Z',
      subject: 'legacy util',
      files: ['src/legacy_util.py']
    },
    {
      hash: 'eeeeeeee',
      author: 'Bob',
      date: '2025-11-01T10:00:00.000Z',
      subject: 'legacy again',
      files: ['src/legacy_util.py']
    }
  ];

  it('parseGitLogNameOnly membaca commit + file', () => {
    const raw = [
      'COMMIT\taaa\tAda\t2026-08-01T10:00:00.000Z\twire trainer',
      'src/train.py',
      'src/config.py',
      '',
      'COMMIT\tbbb\tBob\t2026-07-01T10:00:00.000Z\tignore lock',
      'package-lock.json',
      'src/train.py'
    ].join('\n');
    const parsed = parseGitLogNameOnly(raw);
    assert.strictEqual(parsed.length, 2);
    assert.deepStrictEqual(parsed[0].files, ['src/train.py', 'src/config.py']);
    assert.deepStrictEqual(parsed[1].files, ['src/train.py']);
  });

  it('memisahkan file hidup vs beku', () => {
    const churn = buildFileChurn(commits, now);
    const { alive, frozen } = pickAliveAndFrozen(churn, {
      aliveLimit: 5,
      frozenLimit: 5,
      frozenAfterDays: 60
    });
    assert.ok(alive.some((item) => item.path === 'src/train.py'));
    assert.ok(frozen.some((item) => item.path === 'src/legacy_util.py'));
  });

  it('mendeteksi coupling co-change', () => {
    const couplings = buildCouplings(commits, {
      minCoupling: 2,
      maxFilesPerCommit: 18,
      limit: 5
    });
    assert.ok(
      couplings.some(
        (pair) =>
          (pair.a === 'src/config.py' && pair.b === 'src/train.py') ||
          (pair.a === 'src/train.py' && pair.b === 'src/config.py')
      )
    );
  });

  it('owner dari frekuensi author per file', () => {
    const owners = buildOwnersFromCommits(commits, ['src/train.py'], 3);
    assert.strictEqual(owners[0]?.author, 'Ada');
    assert.ok((owners[0]?.share ?? 0) > 0.5);
  });

  it('buildGitHistoryInsightsFromCommits mengisi ringkasan', () => {
    const insights = buildGitHistoryInsightsFromCommits('/repo', commits, {
      now,
      language: 'id',
      frozenAfterDays: 60
    });
    assert.ok(insights.summaryBullets.length > 0);
    assert.ok(insights.aliveFiles.length > 0);
    assert.ok(insights.couplings.length > 0);
  });
});
