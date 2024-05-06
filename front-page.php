<?php get_header() ?>

<section class="p-front-page-kv l-container">
  <h1>Niiyama Keisuke</h1>
  <span>full-stack web engineer</span>

  <ul>
    <li>
      サイトコーディング
    </li>
    <li>
      WordPress構築
    </li>
    <li>
      フロントエンド構築
    </li>
    <li>
      バックエンド構築
    </li>
    <li>
      API構築
    </li>
    <li>
      Webライティング
    </li>
    <li>
      広告運用
    </li>
    <li>
      ディレクション
    </li>
    <li>
      システム設計
    </li>
  </ul>
</section>

<section class="p-front-page-message l-container">
  <h2 class="l-section-title">
    Message
  </h2>

  <main>
    <h3>ただ、"アナタ"のために。</h3>
    <p>
      "アナタ"のビジネスをもっと多くの人に。<br>
      "アナタ"の考えがすぐにカタチにできるように。<br>
      "アナタ"が笑顔がずっと続くように。<br>
      <br>
      私は、"アナタ"に合わせた、<br>
      最適なWebソリューションを提供しています。
    </p>

    <aside>UNOTAME - 新山慶介</aside>
  </main>
</section>

<section class="p-front-page-works l-container">
  <h2 class="l-section-title">WORKS</h2>

  <?php
  $args = array(
    'post_type' => 'post',
    'posts_per_page' => 5,
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
            <img src="<?php echo get_template_directory_uri(); ?>/assets/img/img-works-unotame.png" alt="">
            <div class="p-front-page-works__detail">
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
</section>
<section class="p-front-page-about l-container">
  <h2 class="l-section-title">ABOUT</h2>

  <div class="p-front-page-about__card">
    <img src="<?php echo get_template_directory_uri(); ?>/assets/img/profile.png" alt="">

    <div class="p-front-page-about__card-profile">
      <h3>新山 慶介</h3>
      <span>Niiyama Keisuke</span>

      <p>
        2021年よりWeb系フリーランスとして活動。<br>
        2023年にWebディレクターとして制作会社へ就職。<br>
        2024年現在、会社員 兼 フリーランスとしてIT全般の業務に従事。
      </p>
    </div>
  </div>

  <a href="<?php echo esc_url(home_url('works')); ?>" class="c-btn-view-more">View More</a>

</section>

<section class="p-front-page-contact">
  <a href="<?php echo home_url() ?>">
    <h2>CONTACT</h2>
  </a>
</section>

<?php get_footer() ?>