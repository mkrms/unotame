<!DOCTYPE html>
<html lang="ja">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UNOTAME</title>

  <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/assets/css/destyle.css">
  <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/assets/css/style.css">

  <?php wp_head(); ?>
</head>

<body>
  <div class="loader-bg">
    <div class="loader"></div>
  </div>

  <header id="header" class="l-header">
    <a href="<?php echo home_url() ?>" class="l-header__logo">
      <img src="<?php echo get_template_directory_uri() ?>/assets/img/logo-landscape-removebg.png" alt="UNOTAME LOGO" class="l-header__logo-img">
    </a>

    <nav id="nav" class="l-header__nav">
      <ul class="l-header__nav__list">
        <li class="l-header__nav__list__item">
          <a href="<?php echo home_url() ?>" class="header__nav__list__item-link">ABOUT</a>
        </li>
        <li class="l-header__nav__list__item">
          <a href="<?php echo home_url() ?>" class="header__nav__list__item-link">WORKS</a>
        </li>
      </ul>
    </nav>
  </header>