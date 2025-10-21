<template>
  <main>
    <h1>Porfolio - Items</h1>
    <ItemList />
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
main { padding: 1rem; font-family: Arial, Helvetica, sans-serif; }
h1 { color: #333; }
</style>
