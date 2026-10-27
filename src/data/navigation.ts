// グローバルナビの項目（layout.md）。href は routes.* で作り、直書きしない。
import { routes } from '../lib/routes';

export type NavItem = {
  key: 'about' | 'works' | 'contact';
  /** 表示文字列（現行どおり大文字） */
  label: string;
  href: string;
};

export const globalNav: readonly NavItem[] = [
  { key: 'about', label: 'ABOUT', href: routes.about() },
  { key: 'works', label: 'WORKS', href: routes.works() },
  { key: 'contact', label: 'CONTACT', href: routes.contact() },
];
