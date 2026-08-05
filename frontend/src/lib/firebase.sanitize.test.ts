import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore } from '../lib/firebase';

describe('sanitizeForFirestore', () => {
  it('omits undefined fields such as failureReason', () => {
    const input = {
      id: 'p1',
      status: 'Completed',
      failureReason: undefined,
      translationModel: undefined,
      title: 'Demo',
    };
    const out = sanitizeForFirestore(input) as Record<string, unknown>;
    expect(out).toEqual({ id: 'p1', status: 'Completed', title: 'Demo' });
    expect('failureReason' in out).toBe(false);
  });

  it('keeps failureReason when set', () => {
    const out = sanitizeForFirestore({
      id: 'p2',
      status: 'Failed',
      failureReason: 'TTS failed',
    }) as Record<string, unknown>;
    expect(out.failureReason).toBe('TTS failed');
  });

  it('converts undefined array elements to null and sanitizes nested objects', () => {
    const out = sanitizeForFirestore({
      logs: [undefined, { msg: 'ok', detail: undefined }],
    }) as { logs: unknown[] };
    expect(out.logs[0]).toBeNull();
    expect(out.logs[1]).toEqual({ msg: 'ok' });
  });
});
