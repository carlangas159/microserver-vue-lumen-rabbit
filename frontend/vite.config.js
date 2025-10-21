// Configuración mínima de Vite para Vue 3 (CommonJS)
// Usamos require/module.exports para evitar problemas de ESM durante el build en contenedores
const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist'
  }
});
