// フィクスチャ版の CmsSource（CMS_SOURCE=fixture）。API を呼ばず、生のレスポンス形式の JSON を返すだけ。
// 変換・検証は microCMS 版と同じ経路（index.ts の loadContent）を通る。
import worksResponse from '../../../fixtures/microcms/works.json';
import categoriesResponse from '../../../fixtures/microcms/categories.json';
import type { RawCategory, RawListResponse, RawWork } from './raw-types';
import type { CmsSource } from './source';

export type FixtureData = {
  works: RawListResponse<RawWork>;
  categories: RawListResponse<RawCategory>;
};

export const defaultFixtureData: FixtureData = {
  works: worksResponse as RawListResponse<RawWork>,
  categories: categoriesResponse as RawListResponse<RawCategory>,
};

function contentsOf<T>(response: RawListResponse<T>, endpoint: string): T[] {
  if (response.contents.length !== response.totalCount) {
    throw new Error(
      `フィクスチャ ${endpoint} の件数（${response.contents.length}）が totalCount（${response.totalCount}）と一致しません`,
    );
  }
  return response.contents;
}

export function createFixtureSource(data: FixtureData = defaultFixtureData): CmsSource {
  return {
    async listWorks() {
      return contentsOf(data.works, 'works');
    },
    async listCategories() {
      return contentsOf(data.categories, 'categories');
    },
    async getDraftWork() {
      // resolveCmsConfig が CMS_SOURCE=fixture と下書きプレビューの併用を止めるので、ここには来ない
      throw new Error('フィクスチャモードでは下書きプレビューを使えません');
    },
  };
}
