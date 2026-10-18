const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const tripleRnA11y = require('eslint-plugin-triple-rn-a11y');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'coverage/*']),
  expoConfig,
  prettierRecommended,
  // Reglas de accesibilidad para React Native (RNF-11 / RNF-12, WCAG 2.1 AA).
  tripleRnA11y.configs.recommended,
]);
