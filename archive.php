<?php
/*
Template Name: 記事投稿アーカイブページ
*/
?>
<?php get_header(); ?>

<div class="l-page__wrapper l-container">
  <h1 class="l-page-title">記事・実績一覧</h1>

  <div class="p-works">
    <?php
    $args = array(
      'post_type' => 'post',
      'post_status' => 'publish'
    );
    $query = new WP_Query($args);
    ?>
    <ul class="p-works__body">
      <?php if ($query->have_posts()) : ?>
        <?php while ($query->have_posts()) : $query->the_post();
          $cats = get_the_category();
          $cat = $cats[0];
          $cat_name = $cat->name;
          $cat_slug = $cat->slug;
        ?>

          <li data-category="<?php echo $cat_slug ?>" class="is-show">
            <a href="<?php echo get_the_permalink() ?>">
              <img src="<?php echo get_the_post_thumbnail_url() ?>" alt="">
              <div class="p-works__detail">
                <h3><?php echo get_the_title() ?></h3>
                <span><?php echo $cat_name ?></span>
              </div>
            </a>
          </li>

        <?php endwhile; ?>
      <?php else : ?>

        <li class="c-post__item"><span>お知らせはまだ登録されておりません。</span></li>

      <?php endif; ?>
    </ul>

    <ul class="p-works__sidebar">
      <span>Category</span>
      <li id="categoryButton" class="is-active" data-filter="all">
        全て
      </li>

      <?php
      $terms = get_terms('category');

      foreach ($terms as $term) :  ?>
        <li id="categoryButton" data-filter="<?php echo $term->slug; ?>">
          <?php echo $term->name; ?>
        </li>
      <?php endforeach; ?>
    </ul>
  </div>
</div>

<?php get_footer(); ?>