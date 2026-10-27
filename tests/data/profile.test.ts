import { describe, expect, it } from 'vitest';
import { getProfile } from '../../src/lib/profile';

describe('getProfile (top-page / cms-integration)', () => {
  const profile = getProfile();

  it('has the 9 KV skills in order', () => {
    expect(profile.kv).toMatchObject({ name: 'Niiyama Keisuke', role: 'full-stack web engineer' });
    expect(profile.kv.skills).toEqual([
      'サイトコーディング',
      'WordPress構築',
      'フロントエンド構築',
      'バックエンド構築',
      'API構築',
      'Webライティング',
      '広告運用',
      'ディレクション',
      'システム設計',
    ]);
  });

  it('has the corrected message (top-page T-2)', () => {
    expect(profile.message.heading).toBe('ただ、"アナタ"のために。');
    expect(profile.message.lines).toContain('"アナタ"の笑顔がずっと続くように。');
    expect(profile.message.lines.join('\n')).not.toContain('"アナタ"が笑顔が');
    expect(profile.message.lines[3]).toBe('');
    expect(profile.message.signature).toBe('UNOTAME - 新山慶介');
  });

  it('keeps the current bio until the new one arrives (top-page T-1)', () => {
    expect(profile.about.bio).toEqual([
      '2021年よりWeb系フリーランスとして活動。',
      '2023年にWebディレクターとして制作会社へ就職。',
      '2024年現在、会社員 兼 フリーランスとしてIT全般の業務に従事。',
    ]);
    expect(profile.about.photo.alt).toBe('新山 慶介');
    expect(profile.about.photo.src.width).toBeGreaterThan(0);
  });

  it('has 5 socials in order with https URLs and unique labels', () => {
    expect(profile.socials.map((social) => social.id)).toEqual([
      'x',
      'zenn',
      'qiita',
      'note',
      'github',
    ]);
    for (const social of profile.socials) {
      expect(social.url).toMatch(/^https:\/\//);
      expect(social.label).not.toBe('');
      expect(social.icon).toBeDefined();
    }
    const labels = profile.socials.map((social) => social.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps all texts plain (no HTML)', () => {
    const texts = [
      ...profile.kv.skills,
      ...profile.message.lines,
      profile.message.heading,
      ...profile.about.bio,
    ];
    for (const text of texts) expect(text).not.toMatch(/<[a-z/]/i);
  });
});
