import { describe, it, expect } from 'vitest';
import { resolveProjectMediaUrl, getProjectVideoUrl, getProjectDownloadUrl } from '../services/api';

describe('api helpers', () => {
  it('builds project media urls', () => {
    expect(getProjectVideoUrl('abc')).toContain('/api/projects/abc/video');
    expect(getProjectDownloadUrl('abc')).toContain('/api/projects/abc/download');
  });

  it('resolves completed project to secure api path', () => {
    const url = resolveProjectMediaUrl(
      { id: 'abc', status: 'Completed', videoUrl: '' },
      'video'
    );
    expect(url).toContain('/api/projects/abc/video');
  });
});
