<?php

// サムネイル有効化
add_theme_support('post-thumbnails');

/*----------------------------------------------------------*/
/* 投稿アーカイブページの表示設定 */
/*----------------------------------------------------------*/
function post_has_archive($args, $post_type)
{
  if ('post' == $post_type) {
    $args['rewrite'] = true;
    $args['has_archive'] = 'works'; //URLとして使いたい文字列
  }
  return $args;
}
add_filter('register_post_type_args', 'post_has_archive', 10, 2);

/* ---------- 「投稿」の表記変更 ---------- */
function Change_menulabel()
{
  global $menu;
  global $submenu;
  $name = 'ポートフォリオ';
  $menu[5][0] = $name;
  $submenu['edit.php'][5][0] = $name . '一覧';
  $submenu['edit.php'][10][0] = '新規' . $name . '登録';
}
add_action('admin_menu', 'Change_menulabel');


/* ---------- 投稿の「カテゴリー」と「タグ」の非表示 ---------- */
function my_unregister_taxonomies()
{
  global $wp_taxonomies;
  // 「タグ」の非表示
  if (!empty($wp_taxonomies['post_tag']->object_type)) {
    foreach ($wp_taxonomies['post_tag']->object_type as $i => $object_type) {
      if ($object_type == 'post') {
        unset($wp_taxonomies['post_tag']->object_type[$i]);
      }
    }
  }
  return true;
}
add_action('init', 'my_unregister_taxonomies');

/* assets path replace */
function replaceAssetsPath($arg)
{
  $content = str_replace('"assets/', '"' . get_bloginfo('template_directory') . '/assets/', $arg);
  return $content;
}
add_action('the_content', 'replaceAssetsPath');
