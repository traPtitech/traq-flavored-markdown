export default {
  '*.{ts,js,jsx,tsx,mjs,cjs}':
    'eslint --fix --cache --max-warnings=0 --no-warn-ignored',
  '*.{js,jsx,ts,tsx,mjs,cjs,css,scss,sass,html,md,json}':
    'prettier --cache --write'
}
