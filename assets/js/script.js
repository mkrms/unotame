$(function () {
  //読み込みが完了したら実行する
  $(window).on('load', function () {
    //ローディングアニメーションをフェードアウト
    $('.loader').delay(600).fadeOut(600);
    //背景色をフェードアウト
    $('.loader-bg').delay(900).fadeOut(800);
  });

  //ページの読み込みが完了してなくても5秒後にアニメーションを非表示にする
  setTimeout(function () {
    $('.loader-bg').fadeOut(600);
  }, 5000);
});

//category buttons

const filterButtons = document.querySelectorAll('[data-filter]');
const categoryContents = document.querySelectorAll('[data-category]');

filterButtons.forEach((filterButton) => {
  filterButton.addEventListener('click', buttonSwitch);
  filterButton.addEventListener('click', categoryFilter);
});

function buttonSwitch() {
  filterButtons.forEach((filterButton) => {
    filterButton.classList.remove("is-active");
    this.classList.add('is-active');
  });
}

function categoryFilter() {
  const buttonCategory = this.dataset.filter;
  const targetContents = document.querySelectorAll('[data-category="' + buttonCategory + '"]');

  categoryContents.forEach((categoryContent) => {

    categoryContent.animate([{
      opacity: 0
    },
    {
      opacity: 1
    }
    ], {
      duration: 600,
      fill: 'forwards'
    });

    if (buttonCategory == 'all') {
      categoryContent.classList.add('is-show');
    } else {
      categoryContent.classList.remove("is-show");
      targetContents.forEach((targetContent) => {
        targetContent.classList.add('is-show');
      });
    }
  });
}

//adobe fonts
(function (d) {
  var config = {
    kitId: 'woq0phd',
    scriptTimeout: 3000,
    async: true
  },
    h = d.documentElement,
    t = setTimeout(function () {
      h.className = h.className.replace(/\bwf-loading\b/g, "") + " wf-inactive";
    }, config.scriptTimeout),
    tk = d.createElement("script"),
    f = false,
    s = d.getElementsByTagName("script")[0],
    a;
  h.className += " wf-loading";
  tk.src = 'https://use.typekit.net/' + config.kitId + '.js';
  tk.async = true;
  tk.onload = tk.onreadystatechange = function () {
    a = this.readyState;
    if (f || a && a != "complete" && a != "loaded") return;
    f = true;
    clearTimeout(t);
    try {
      Typekit.load(config)
    } catch (e) { }
  };
  s.parentNode.insertBefore(tk, s)
})(document);