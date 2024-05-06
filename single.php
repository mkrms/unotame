<?php get_header() ?>

<div class="l-page__wrapper l-container">
  <h1 class="l-page-title"><?php echo the_title(); ?></h1>

  <div class="p-work-detail">

    <div class="p-work-detail__content">
      <?php
      $cats = get_the_category();
      $cat = $cats[0];
      $cat_name = $cat->name;
      ?>
      <img src="<?php echo the_post_thumbnail_url(); ?>" alt="">

      <span>カテゴリー：<?php echo $cat_name; ?></span>

      <p><?php the_content(); ?></p>
    </div>

    <div class="p-work-detail__latest">
      <h2 class="l-section-title">Latest</h2>

      <?php
      $args = array(
        'post_type' => 'post',
        'posts_per_page' => 3,
        'post_status' => 'publish'
      );
      $query = new WP_Query($args);
      ?>
      <ul>
        <?php if ($query->have_posts()) : ?>
          <?php while ($query->have_posts()) : $query->the_post();
            $cats = get_the_category();
            $cat = $cats[0];
            $cat_name = $cat->name;
          ?>

            <li>
              <a href="<?php echo get_the_permalink() ?>">
                <img src="<?php echo get_the_post_thumbnail_url() ?>" alt="">
                <div class="p-work-detail__latest__detail">
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

      <a href="<?php echo esc_url(home_url('works')); ?>" class="c-btn-view-more">View More</a>

    </div>
  </div>

</div>

<?php get_footer() ?>