// トップの KV・Message・About・SNS（cms-integration「5. トップの KV…の持ち方」案 R / top-page）。
// 文言はプレーンテキスト（HTML を含めない）。ページからは src/lib/profile.ts の getProfile() 経由で読む。
import type { Profile } from '../lib/domain/profile';
import profilePhoto from '../assets/images/profile.png';
import xIcon from '../assets/images/sns/logo-black.png';
import zennIcon from '../assets/images/sns/logo-only.svg';
import qiitaIcon from '../assets/images/sns/qiita-icon.png';
import noteIcon from '../assets/images/sns/square.svg';
import githubIcon from '../assets/images/sns/github-mark.png';

export const profile = {
  kv: {
    name: 'Niiyama Keisuke',
    role: 'full-stack web engineer',
    skills: [
      'サイトコーディング',
      'WordPress構築',
      'フロントエンド構築',
      'バックエンド構築',
      'API構築',
      'Webライティング',
      '広告運用',
      'ディレクション',
      'システム設計',
    ],
  },
  message: {
    heading: 'ただ、"アナタ"のために。',
    lines: [
      '"アナタ"のビジネスをもっと多くの人に。',
      '"アナタ"の考えがすぐにカタチにできるように。',
      // 現行の「"アナタ"が笑顔が…」の誤記を直した文（top-page T-2 / D-012）
      '"アナタ"の笑顔がずっと続くように。',
      '',
      '私は、"アナタ"に合わせた、',
      '最適なWebソリューションを提供しています。',
    ],
    signature: 'UNOTAME - 新山慶介',
  },
  about: {
    nameJa: '新山 慶介',
    nameEn: 'Niiyama Keisuke',
    bio: [
      '2021年よりWeb系フリーランスとして活動。',
      '2023年にWebディレクターとして制作会社へ就職。',
      // 最新の経歴文を受け取ったら差し替える（top-page T-1）。それまでは現行の文
      '2024年現在、会社員 兼 フリーランスとしてIT全般の業務に従事。',
    ],
    photo: { src: profilePhoto, alt: '新山 慶介' },
  },
  socials: [
    { id: 'x', label: 'X', url: 'https://x.com/niiyamakeisuke/', icon: xIcon },
    { id: 'zenn', label: 'Zenn', url: 'https://zenn.dev/niiyama_k', icon: zennIcon },
    { id: 'qiita', label: 'Qiita', url: 'https://qiita.com/unotame/', icon: qiitaIcon },
    { id: 'note', label: 'note', url: 'https://note.com/unotame/', icon: noteIcon },
    { id: 'github', label: 'GitHub', url: 'https://github.com/mkrms', icon: githubIcon },
  ],
} satisfies Profile;
