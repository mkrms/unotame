// プロフィールの取得口（cms-integration）。ページは src/data/profile.ts を直接 import せず、これを使う。
// CMS へ移す場合（将来拡張）は、この関数の中身だけを差し替える。
import { profile } from '../data/profile';
import type { Profile } from './domain/profile';

export function getProfile(): Profile {
  return profile;
}
