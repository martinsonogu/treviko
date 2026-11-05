const config = {
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}": ["eslint --max-warnings=0", "prettier --check"],
  "*.{json,md,yml,yaml,css}": "prettier --check",
};

export default config;
