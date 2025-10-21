<template>
  <main class="container">
    <header class="hero">
      <div class="container">
        <h1>Porfolio - Items</h1>
        <p>Lista de items y sincronización en tiempo real entre pestañas.</p>
      </div>
    </header>

    <section class="container">
      <ItemList />
    </section>
  </main>
</template>

<script>
import ItemList from './components/ItemList.vue';

/**
 * Componente raíz de la aplicación.
 * Renderiza el listado de items.
 *
 * Ejemplos de uso (en español):
 * 1) <App /> en index.html como entry point de la SPA.
 * 2) Usar <App/> dentro de un test para montar la aplicación.
 * 3) Extender App.vue para añadir rutas o layout global.
 */
export default {
  name: 'App',
  components: { ItemList }
};
</script>

<style>
:root { --app-padding: 1rem; }
main { padding: var(--app-padding); }
.hero { margin-bottom: 1rem; }
.hero h1 { margin: 0 0 0.25rem 0; }
</style>
