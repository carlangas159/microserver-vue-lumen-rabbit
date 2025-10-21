'use strict';

const amqp = require('amqplib');
require('dotenv').config();
const WebSocket = require('ws');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'shared_items';
const WS_PORT = parseInt(process.env.WS_PORT || '3000', 10);
const MAX_RETRIES = parseInt(process.env.RABBITMQ_RETRY_COUNT || '30', 10);
const INITIAL_DELAY_MS = parseInt(process.env.RABBITMQ_RETRY_DELAY_MS || '1000', 10);

/**
 * Espera asíncronamente el número de milisegundos especificado.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 *
 * Ejemplos de uso (en español):
 * 1) await sleep(1000); // espera 1 segundo
 * 2) await sleep(process.env.DELAY_MS); // espera el valor de la variable de entorno
 * 3) // usar dentro de un bucle de reintento para backoff exponencial
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Conecta a RabbitMQ con reintentos y backoff exponencial.
 * @async
 * @param {string} [url]
 * @returns {Promise<{connection: import('amqplib').Connection, channel: import('amqplib').Channel}>}
 *
 * Ejemplos de uso (en español):
 * 1) await connectToRabbit(); // intenta conectar con retries configurados
 * 2) await connectToRabbit('amqp://guest:guest@localhost:5672/');
 * 3) // útil en servicios que deben tolerar arranques del broker
 */
async function connectToRabbit(url = RABBITMQ_URL) {
  let attempt = 0;
  let delay = INITIAL_DELAY_MS;

  while (true) {
    attempt += 1;
    try {
      console.log(`[realtime] Intentando conectar a RabbitMQ (intento ${attempt}) -> ${url}`);
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      console.log('[realtime] Conectado a RabbitMQ con éxito');
      return { connection, channel };
    } catch (err) {
      const isLast = attempt >= MAX_RETRIES;
      console.error(`[realtime] Error al conectar a RabbitMQ en intento ${attempt}:`, err && err.code ? `${err.code} ${err.message}` : err);
      if (isLast) {
        console.error('[realtime] Superado número máximo de reintentos, abortando');
        throw err;
      }
      const jitter = Math.floor(Math.random() * 300);
      const waitMs = delay + jitter;
      console.log(`[realtime] Esperando ${waitMs}ms antes del siguiente intento...`);
      await sleep(waitMs);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

// Manejador simple de WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });
let wsClients = new Set();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  wsClients.add(ws);
  console.log('[realtime] Cliente WS conectado, total:', wsClients.size);

  ws.on('message', (message) => {
    // Opcional: permitir que clientes envíen mensajes directos (no es necesario si se usa /api/share)
    try {
      const data = JSON.parse(message);
      // Re-broadcast local: enviar a todos
      broadcast(JSON.stringify(data));
    } catch (e) {
      console.warn('[realtime] Mensaje WS no JSON recibido');
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('[realtime] Cliente WS desconectado, total:', wsClients.size);
  });
});

/**
 * Envía el mensaje a todos los clientes WebSocket conectados.
 * @param {string} msg - Mensaje (JSON stringificado) a enviar.
 */
function broadcast(msg) {
  for (const client of Array.from(wsClients)) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

/**
 * Consume la cola RabbitMQ y reenvía cada mensaje a los clientes WebSocket.
 * @async
 * @param {import('amqplib').Channel} channel - Canal AMQP ya conectado.
 * @param {string} queue - Nombre de la cola a consumir.
 * @returns {Promise<void>}
 *
 * Ejemplos de uso (en español):
 * 1) await consumeQueue(channel, 'shared_items');
 * 2) // usar para retransmitir mensajes a todos los navegadores conectados
 * 3) // útil para integrar con el endpoint POST /api/share del backend
 */
async function consumeQueue(channel, queue = QUEUE_NAME) {
  await channel.assertQueue(queue, { durable: true });
  console.log(`[realtime] Consumiendo la cola: ${queue}`);

  await channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const content = msg.content.toString('utf8');
      let payload;
      try { payload = JSON.parse(content); } catch (e) { payload = { raw: content }; }
      console.log('[realtime] Mensaje recibido de cola:', payload);
      // Reenviamos a todos los clientes WS
      broadcast(JSON.stringify({ source: 'realtime', payload }));
      channel.ack(msg);
    } catch (err) {
      console.error('[realtime] Error procesando mensaje:', err);
      try { channel.nack(msg, false, false); } catch (e) { console.error('[realtime] Error haciendo nack:', e); }
    }
  }, { noAck: false });
}

// Arranca el servicio: conectar a Rabbit y consumir, manteniendo WS vivo
async function start() {
  try {
    const { connection, channel } = await connectToRabbit();
    await consumeQueue(channel, QUEUE_NAME);

    // Heartbeat para clientes WS
    setInterval(() => {
      for (const ws of Array.from(wsClients)) {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping(() => {});
      }
    }, 30000);

    console.log(`[realtime] WebSocket server listening on ws://0.0.0.0:${WS_PORT}`);

    // Manejo de cierre limpio
    process.on('SIGINT', async () => {
      console.log('[realtime] SIGINT recibido, cerrando...');
      try { await channel.close(); } catch (e) {}
      try { await connection.close(); } catch (e) {}
      wss.close(() => process.exit(0));
    });
  } catch (err) {
    console.error('[realtime] No se pudo iniciar el servicio realtime:', err);
    process.exit(1);
  }
}

// Si se ejecuta directamente, arrancamos
if (require.main === module) {
  start();
}

module.exports = { start, broadcast };
