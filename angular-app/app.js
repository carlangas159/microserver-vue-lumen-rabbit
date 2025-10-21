(function () {
  'use strict';

  /**
   * Módulo y controlador principal de la app AngularJS.
   * No usa servicios personalizados, todo está en el controlador para simplicidad.
   */
  angular.module('porfolioApp', [])
    .controller('MainCtrl', ['$scope', '$http', '$window', '$timeout', function ($scope, $http, $window, $timeout) {
      const vm = this;

      /**
       * Lista de items cargados desde /api/items
       * @type {Array<Object>}
       *
       * Ejemplos de uso (en español):
       * 1) vm.items -> contiene los objetos recibidos del backend.
       * 2) // Usado en ng-repeat: item in vm.items
       * 3) // Se actualiza cuando se recibe un `share_item` desde realtime.
       */
      vm.items = [];

      /**
       * Id del item seleccionado/compartido (resaltado)
       * @type {number|null}
       *
       * Ejemplos de uso (en español):
       * 1) vm.selectedId = 5; // marca item con id 5 como compartido
       * 2) // Se actualiza al recibir mensajes WS
       * 3) // Se usa en ng-class para aplicar la clase `shared`
       */
      vm.selectedId = null;

      /**
       * Estado de carga
       * @type {boolean}
       */
      vm.loading = false;
      vm.error = null;

      /**
       * Estado de conexión WS
       * @type {boolean}
       */
      vm.wsConnected = false;

      // URL del WebSocket (por defecto el host local que expone el servicio realtime)
      const WS_URL = (function () {
        try {
          // Permite override si se define en window.WS_URL desde el index o env
          if ($window.WS_URL) return $window.WS_URL;
        } catch (e) {}
        return 'ws://localhost:3000';
      }());

      let ws = null;
      let reconnectDelay = 1000;
      const MAX_RECONNECT = 30000;

      /**
       * Carga los items desde la API /api/items.
       * @returns {Promise<void>}
       *
       * Ejemplos de uso (en español):
       * 1) vm.loadItems(); // recarga la lista
       * 2) // llamado en la inicialización para poblar vm.items
       * 3) // se puede enlazar a un botón para refrescar
       */
      vm.loadItems = function () {
        vm.loading = true;
        vm.error = null;
        return $http.get('/api/items').then(function (res) {
          vm.items = Array.isArray(res.data) ? res.data : [];
        }).catch(function (err) {
          vm.error = err && err.message ? err.message : 'Error cargando items';
        }).finally(function () {
          vm.loading = false;
          $scope.$applyAsync && $scope.$applyAsync();
        });
      };

      /**
       * Envía el item compartido por WebSocket o por fallback HTTP (/api/share).
       * @param {Object} item - item a compartir
       * @returns {Promise<void>}
       *
       * Ejemplos de uso (en español):
       * 1) vm.sendSharedItem(item);
       * 2) // Si WS abierto se enviará por socket, si no, hará POST a /api/share
       * 3) // Usado por vm.share al hacer click en un item
       */
      vm.sendSharedItem = function (item) {
        return new Promise(function (resolve) {
          const payload = JSON.stringify({ action: 'share_item', item: item });
          if (vm.wsConnected && ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(payload);
              return resolve();
            } catch (e) {
              console.warn('[angular-app] Error enviando por WS, fallback HTTP:', e);
            }
          }

          // Fallback HTTP
          $http.post('/api/share', { item: item }).then(function () {
            resolve();
          }).catch(function (err) {
            console.warn('[angular-app] Fallback HTTP falló:', err);
            resolve();
          });
        });
      };

      /**
       * Acción al hacer click en un item: comparte y marca localmente.
       * @param {Object} item
       * @returns {Promise<void>}
       *
       * Ejemplos de uso (en español):
       * 1) ng-click="vm.share(item)"
       * 2) // establece vm.selectedId y notifica a otras ventanas
       * 3) // útil para sincronizar selección entre pestañas
       */
      vm.share = function (item) {
        if (!item || typeof item !== 'object') return;
        vm.selectedId = item.id;
        vm.sendSharedItem(item);
      };

      /**
       * Maneja mensajes entrantes desde el servidor realtime.
       * @param {string} raw - mensaje crudo recibido
       * Ejemplos de uso (en español):
       * 1) handleIncoming('{"action":"share_item","item":{...}}')
       * 2) // se encarga de normalizar formato de realtime
       * 3) // actualiza vm.selectedId y agrega item si no existe
       */
      function handleIncoming(raw) {
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          console.warn('[angular-app] Mensaje WS no JSON:', raw);
          return;
        }

        let payload = parsed;
        if (parsed && parsed.source && parsed.payload) payload = parsed.payload;

        if (payload && payload.action === 'share_item' && payload.item) {
          try {
            // Normalizar id a número cuando sea posible (evitar comparaciones estrictas fallidas)
            const shared = payload.item;
            if (shared && shared.id != null) {
              const n = Number(shared.id);
              if (!Number.isNaN(n)) shared.id = n;
            }

            console.debug('[angular-app] Mensaje share_item recibido:', payload);

            vm.selectedId = shared.id;
            const exists = vm.items.some(function (it) { return Number(it.id) === Number(shared.id); });
            if (!exists) {
              vm.items.unshift(shared);
            }
          } catch (err) {
            console.error('[angular-app] Error procesando payload:', err, payload);
          }
          // Forzar digest para que la vista refleje siempre la selección remota
          $scope.$applyAsync && $scope.$applyAsync();
        }
      }

      /**
       * Establece conexión WebSocket y handlers (reconexión simple con backoff).
       */
      function connectWebSocket() {
        try {
          ws = new WebSocket(WS_URL);
        } catch (e) {
          console.warn('[angular-app] Error creando WebSocket:', e);
          scheduleReconnect();
          return;
        }

        ws.onopen = function () {
          vm.wsConnected = true;
          // Exponer el socket en window para depuración rápida en el navegador
          try { window.__ang_ws = ws; } catch (e) {}
          reconnectDelay = 1000;
          console.info('[angular-app] WS conectado a', WS_URL);
          $scope.$applyAsync && $scope.$applyAsync();
        };

        ws.onmessage = function (ev) {
          // Log crudo para depuración: mostrar el mensaje tal cual llega
          try { console.debug('[angular-app] WS raw message:', ev.data); } catch (e) {}
          handleIncoming(ev.data);
        };

        ws.onclose = function () {
          vm.wsConnected = false;
          $scope.$applyAsync && $scope.$applyAsync();
          scheduleReconnect();
        };

        ws.onerror = function (err) {
          console.warn('[angular-app] Error WS', err);
        };
      }

      function scheduleReconnect() {
        const delay = reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT);
        $timeout(function () { connectWebSocket(); }, delay);
      }

      // Inicialización
      vm.loadItems();
      connectWebSocket();

      // Cleanup on unload
      $window.addEventListener && $window.addEventListener('unload', function () {
        try { ws && ws.close(); } catch (e) {}
      });

    }]);
})();
