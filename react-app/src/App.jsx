import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * Componente principal de la aplicación React que muestra los items y permite compartirlos via WebSocket/RabbitMQ.
 *
 * Ejemplos de uso (en español):
 * 1) <App /> // renderiza la lista de items y conecta al servicio realtime
 * 2) // Hacer click en un item lo comparte con las demás ventanas conectadas
 * 3) // Si WS falla, se intenta publicar en /api/share como fallback
 */
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const reconnectDelayRef = useRef(1000);
  const MAX_RECONNECT = 30000;
  const WS_URL = (import.meta.env.VITE_WS_URL) || 'ws://localhost:3000';

  // Carga items desde /api/items
  /**
   * Carga los items desde la API backend.
   * Ejemplos (en español):
   * 1) await loadItems(); // recarga manual
   * 2) // llamado al montar el componente
   * 3) // útil si se implementa un botón de "recargar"
   */
  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/items');
      setItems(res.data || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Enviar item compartido (WS o fallback HTTP)
  /**
   * Envía el item compartido por WS o por fallback HTTP /api/share.
   * @param {Object} item
   * Ejemplos (en español):
   * 1) await sendSharedItem({ id: 1, title: '...' });
   * 2) // si WS está abierto lo usará; si no, hará POST a /api/share
   * 3) // usado al hacer click en un item
   */
  async function sendSharedItem(item) {
    const message = JSON.stringify({ action: 'share_item', item });
    if (wsConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(message);
        return;
      } catch (e) {
        console.warn('[react-app] Error enviando por WS, fallback HTTP:', e);
      }
    }

    try {
      await axios.post('/api/share', { item });
    } catch (e) {
      console.warn('[react-app] Fallback HTTP /api/share falló:', e?.message || e);
    }
  }

  // Compartir acción de click
  async function share(item) {
    if (!item) return;
    setSelectedId(item.id);
    await sendSharedItem(item);
  }

  // Manejar mensajes entrantes
  function handleIncomingMessage(raw) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.warn('[react-app] Mensaje no JSON recibido');
      return;
    }

    let payload = parsed;
    if (parsed && parsed.source && parsed.payload) payload = parsed.payload;

    if (payload && payload.action === 'share_item' && payload.item) {
      const shared = payload.item;
      setSelectedId(shared.id);
      setItems((prev) => (prev.some((it) => it.id === shared.id) ? prev : [shared, ...prev]));
    }
  }

  // Conexión WS con reconexión exponencial
  function connectWebSocket() {
    try {
      wsRef.current = new WebSocket(WS_URL);
    } catch (e) {
      console.warn('[react-app] Error creando WebSocket:', e);
      scheduleReconnect();
      return;
    }

    wsRef.current.addEventListener('open', () => {
      setWsConnected(true);
      reconnectDelayRef.current = 1000;
      console.log('[react-app] WS conectado a', WS_URL);
    });

    wsRef.current.addEventListener('message', (ev) => {
      handleIncomingMessage(ev.data);
    });

    wsRef.current.addEventListener('close', () => {
      setWsConnected(false);
      console.log('[react-app] WS cerrado, reintentando...');
      scheduleReconnect();
    });

    wsRef.current.addEventListener('error', (ev) => {
      console.warn('[react-app] Error WS', ev);
    });
  }

  function scheduleReconnect() {
    const delay = reconnectDelayRef.current;
    reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT);
    setTimeout(() => {
      console.log(`[react-app] Reconectando WS en ${delay}ms`);
      connectWebSocket();
    }, delay);
  }

  useEffect(() => {
    loadItems();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>PorfolioRest - React</h1>
        <div className="status">{wsConnected ? <span className="chip">Conectado</span> : <span className="chip muted">Offline</span>}</div>
      </header>

      <main className="container">
        {loading && <div className="notice">Cargando...</div>}
        {error && <div className="notice -danger">Error: {error}</div>}

        <ul className="simple-list">
          {items.map((item) => (
            <li key={item.id} className={`list-item ${selectedId === item.id ? 'shared' : ''}`}>
              <button className="list-btn" onClick={() => share(item)} aria-pressed={selectedId === item.id}>
                <span className="item-id">#{item.id}</span>
                <span className="item-desc">{item.description || item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <footer className="app-footer">Puerto: 9003 — React app</footer>
    </div>
  );
}

