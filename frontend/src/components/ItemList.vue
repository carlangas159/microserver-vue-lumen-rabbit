<template>
  <section class="container">
    <div class="grid">
      <div class="col-6">
        <button class="contrast" @click="reload">Recargar</button>
      </div>
      <div class="col-6 right">
        <span v-if="wsConnected" class="chip">Conectado</span>
        <span v-else class="chip muted">Offline</span>
      </div>
    </div>

    <div v-if="loading" class="notice">Cargando...</div>
    <div v-else-if="error" class="notice -danger">Error: {{ error }}</div>

    <!-- Lista simple: una fila por elemento, mostrar solo ID y descripción -->
    <ul v-else class="list simple-list">
      <li v-for="item in items" :key="item.id" :class="['list-item', { shared: selectedId === item.id }]">
        <button type="button" class="list-btn" @click="share(item)" :aria-pressed="selectedId === item.id">
          <span class="row">
            <span class="item-id">#{{ item.id }}</span>
            <span class="item-desc">{{ item.description || item.title }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
import axios from 'axios';
import { ref, onBeforeUnmount } from 'vue';

/**
 * Lista reactiva de items.
 * @type {import('vue').Ref<Array<Object>>}
 */
const items = ref([]);

/**
 * Indica si la solicitud está en curso.
 * @type {import('vue').Ref<boolean>}
 */
const loading = ref(false);

/**
 * Mensaje de error en caso de fallo.
 * @type {import('vue').Ref<string|null>}
 */
const error = ref(null);

/**
 * Id del item que fue recientemente compartido/seleccionado por alguna ventana.
 * @type {import('vue').Ref<number|null>}
 */
const selectedId = ref(null);

/**
 * WebSocket activo (si hay).
 * @type {import('vue').Ref<WebSocket|null>}
 */
const ws = ref(null);

/**
 * Indica si la conexión WS está abierta.
 * @type {import('vue').Ref<boolean>}
 */
const wsConnected = ref(false);

// URL del servidor realtime (Vite env fallback). Ej: VITE_WS_URL=ws://realtime:3000
const WS_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) || 'ws://localhost:3000';

// Parámetros de reconexión
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Carga los items desde la API /api/items.
 * @async
 * @function loadItems
 * @returns {Promise<void>} No retorna valor, actualiza estados reactivos.
 *
 * Ejemplos de uso (en español):
 * 1) await loadItems(); // recarga los items manualmente
 * 2) // se puede llamar en mounted para poblar la UI al inicio
 * 3) // útil para reintentos en caso de error
 */
async function loadItems() {
  loading.value = true;
  error.value = null;
  try {
    const res = await axios.get('/api/items');
    items.value = res.data || [];
  } catch (e) {
    error.value = (e && e.message) ? e.message : 'Error desconocido';
  } finally {
    loading.value = false;
  }
}

/**
 * Función para recargar manualmente los items.
 * @function reload
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) reload(); // fuerza una recarga desde la API
 * 2) // enlazar a un botón para permitir al usuario refrescar
 * 3) // combinar con backoff si hay errores temporales
 */
function reload() {
  loadItems();
}

/**
 * Conecta al servidor WebSocket y establece handlers básicos.
 * Implementa reconexión exponencial en caso de cierre.
 * @function connectWebSocket
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) connectWebSocket(); // iniciar conexión WS al montar el componente
 * 2) // se reconectará automáticamente si el servidor cae temporalmente
 * 3) // útil para sincronizar acciones entre pestañas/ventanas
 */
function connectWebSocket() {
  try {
    ws.value = new WebSocket(WS_URL);
  } catch (e) {
    console.warn('[ItemList] Error creando WebSocket:', e);
    scheduleReconnect();
    return;
  }

  ws.value.addEventListener('open', () => {
    wsConnected.value = true;
    reconnectDelay = 1000; // reset delay
    console.log('[ItemList] WS conectado a', WS_URL);
  });

  ws.value.addEventListener('message', (ev) => {
    handleIncomingMessage(ev.data);
  });

  ws.value.addEventListener('close', () => {
    wsConnected.value = false;
    console.log('[ItemList] WS cerrado, intentando reconectar...');
    scheduleReconnect();
  });

  ws.value.addEventListener('error', (ev) => {
    console.warn('[ItemList] Error WS', ev);
  });
}

/**
 * Programa un intento de reconexión con backoff exponencial.
 * @function scheduleReconnect
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) scheduleReconnect(); // programa la reconexión tras un cierre
 * 2) // usado internamente por connectWebSocket en onclose
 * 3) // evita reconexiones agresivas con backoff exponencial
 */
function scheduleReconnect() {
  const delay = reconnectDelay;
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  setTimeout(() => {
    console.log(`[ItemList] Intentando reconectar WS en ${delay}ms`);
    connectWebSocket();
  }, delay);
}

/**
 * Maneja mensajes entrantes desde el servidor realtime y normaliza el payload.
 * Si se recibe un evento "share_item", actualiza la selección y agrega el item si no existe.
 * @function handleIncomingMessage
 * @param {string} raw - Mensaje crudo recibido por WS.
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) handleIncomingMessage('{"action":"share_item","item":{"id":1}}');
 * 2) // manejar mensajes que vienen envueltos como { source: 'realtime', payload: {...} }
 * 3) // actualiza selectedId para reflejar selección remota
 */
function handleIncomingMessage(raw) {
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('[ItemList] Mensaje entrante no JSON:', raw);
    return;
  }

  // Normalizar: en realtime/index.js se reenvía { source: 'realtime', payload }
  let payload = parsed;
  if (parsed && parsed.source && parsed.payload) {
    payload = parsed.payload;
  }

  if (payload && payload.action === 'share_item' && payload.item) {
    const shared = payload.item;
    selectedId.value = shared.id;
    // Añadir item si no existe
    if (!items.value.some((it) => it.id === shared.id)) {
      items.value.unshift(shared);
    }
    console.log('[ItemList] Item compartido recibido:', shared);
  }
}

/**
 * Envía por WebSocket (o por fallback HTTP) el item a compartir.
 * @async
 * @function sendSharedItem
 * @param {Object} item - Item a compartir.
 * @returns {Promise<void>}
 *
 * Ejemplos de uso (en español):
 * 1) await sendSharedItem({ id: 1, title: 'Hola' });
 * 2) // si WS no está disponible, intenta POST /api/share como fallback
 * 3) // usado por share() al hacer click en un item
 */
async function sendSharedItem(item) {
  const message = JSON.stringify({ action: 'share_item', item });
  if (wsConnected.value && ws.value && ws.value.readyState === WebSocket.OPEN) {
    try {
      ws.value.send(message);
      return;
    } catch (e) {
      console.warn('[ItemList] Error enviando por WS, usando fallback HTTP:', e);
    }
  }

  // Fallback al backend (si existe un endpoint /api/share que publique en RabbitMQ)
  try {
    await axios.post('/api/share', { item });
  } catch (e) {
    console.warn('[ItemList] Fallback HTTP /api/share falló:', e && e.message ? e.message : e);
  }
}

/**
 * Acción a ejecutar al hacer click en un item: comparte el item y lo marca localmente.
 * @async
 * @function share
 * @param {Object} item - Item seleccionado para compartir.
 * @returns {Promise<void>}
 *
 * Ejemplos de uso (en español):
 * 1) await share(item); // desde un handler de click
 * 2) // establece selectedId y notifica a otras ventanas
 * 3) // si WS no está disponible, intenta publicar vía API
 */
async function share(item) {
  if (!item || typeof item !== 'object') return;
  selectedId.value = item.id;
  await sendSharedItem(item);
}

/**
 * Cierra la conexión WebSocket (limpieza al desmontar).
 * @function closeWebSocket
 * @returns {void}
 *
 * Ejemplos de uso (en español):
 * 1) closeWebSocket(); // cerrar al desmontar el componente
 * 2) // útil para forzar reconexión manual
 * 3) // evita fugas de sockets cuando la ruta cambia
 */
function closeWebSocket() {
  if (ws.value) {
    try {
      ws.value.close();
    } catch (e) {
      // ignore
    }
    ws.value = null;
    wsConnected.value = false;
  }
}

// Cargar items al montar y conectar WS
loadItems();
connectWebSocket();

// Limpieza
onBeforeUnmount(() => {
  closeWebSocket();
});
</script>

<style>
/* Estilos simplificados para fondo oscuro y listado lineal */
.simple-list { display: block; padding: 0; margin: 0; }
.simple-list .list-item { list-style: none; margin: 0 0 0.35rem 0; }
.simple-list .list-btn { display: block; width: 100%; padding: 0; margin: 0; border: 0; background: transparent; color: inherit; text-align: left; }
.simple-list .row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  background: transparent; /* respetar fondo negro de la app */
  color: #e6e6e6; /* texto claro */
}
.simple-list .row .item-id { color: #9ca3af; font-weight: 600; margin-right: 0.75rem; }
.simple-list .row .item-desc { flex: 1; color: #e6e6e6; white-space: normal; overflow: hidden; text-overflow: ellipsis; }

/* Hover / focus mínimo: solo cursor y fondo muy ligero (sin mover contenido) */
.simple-list .list-btn:focus .row,
.simple-list .list-btn:hover .row,
.simple-list .list-item:focus-within .row {
  background: rgba(255,255,255,0.02);
}

/* Destacar solo cuando se comparte */
.simple-list .list-item.shared .row {
  background: rgba(16,185,129,0.12);
  border-left: 4px solid #10b981;
  padding-left: calc(0.5rem - 4px);
}

/* Asegurar legibilidad en móviles */
@media (max-width: 520px) {
  .simple-list .row { padding: 0.6rem 0.5rem; }
  .simple-list .row .item-id { margin-right: 0.5rem; }
}
</style>
