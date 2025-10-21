// Punto de entrada de la aplicación Vue 3
import { createApp } from 'vue';
import App from './App.vue';

/**
 * Inicia y monta la aplicación Vue en el DOM.
 * @function bootstrapApp
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) bootstrapApp(); // monta la aplicación en el elemento #app
 * 2) // llamar esta función después de inicializar alguna configuración global
 * 3) // útil para tests: se puede llamar y luego desmontar el root
 */
export function bootstrapApp() {
  createApp(App).mount('#app');
}

// Ejecutamos el bootstrap por defecto cuando se importa el módulo
bootstrapApp();
