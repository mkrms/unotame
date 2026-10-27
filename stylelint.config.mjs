export default {
  extends: ['stylelint-config-standard-scss'],
  ignoreFiles: ['dist/**', 'legacy/**'],
  rules: {
    // FLOCSS の BEM 風クラス名（l-header__nav, is-active など）を許す
    'selector-class-pattern': null,
  },
};
