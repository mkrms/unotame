// トップの人物情報の型（top-page T-6 / cms-integration）。値は src/data/profile.ts。
import type { ImageMetadata } from 'astro';

export type SocialLink = {
  /** 並び・テスト用の識別子 */
  id: 'x' | 'zenn' | 'qiita' | 'note' | 'github';
  /** サービス名。リンクのアクセシブルネームに使う */
  label: string;
  /** https の絶対 URL */
  url: string;
  /** src/assets/images/sns/ の画像を import した値 */
  icon: ImageMetadata;
};

export type Profile = {
  kv: {
    /** ページの h1 */
    name: string;
    role: string;
    /** 表示順どおり */
    skills: string[];
  };
  message: {
    heading: string;
    /** 1 要素 = 1 行。'' は空行 */
    lines: string[];
    signature: string;
  };
  about: {
    nameJa: string;
    nameEn: string;
    /** 1 要素 = 1 行 */
    bio: string[];
    photo: { src: ImageMetadata; alt: string };
  };
  /** X / Zenn / Qiita / note / GitHub の順 */
  socials: SocialLink[];
};
