# PorfolioRest — Instrucciones de ejecución y pruebas

Este repositorio contiene una aplicación fullstack con contenedores Docker para frontend, backend, realtime y RabbitMQ. Este README explica cómo levantar el proyecto localmente, qué hace cada contenedor y cómo probar la sincronización realtime.

Requisitos
- Docker Desktop instalado y funcionando.
- Docker Compose v2 (comando `docker compose`).
- Windows: usar `cmd.exe` (los comandos abajo están formateados para cmd.exe).

Resumen de servicios y puertos (por defecto)
- frontend: http://localhost:9002  (Nginx que sirve la SPA)
- backend:  http://localhost:9001  (API REST PHP)
- realtime: ws://localhost:3000    (WebSocket server para sincronización entre pestañas)
- rabbitmq: AMQP 5672, management UI http://localhost:15672 (usuario: guest / contraseña: guest)

Cómo levantar el proyecto (cmd.exe)
1) Abrir una consola cmd.exe y cambiar al directorio del repo:

    cd /d C:\Work\PorfolioRest

2) (Opcional) Reconstruir imágenes sin cache para obtener un build limpio:

    docker compose build --progress=plain --no-cache

3) Levantar los servicios en background:

    docker compose up --build -d

4) Comprobar el estado de los contenedores:

    docker compose ps
    docker ps -a

5) Ver logs (últimas 200 líneas) por servicio si necesitas depurar:

    docker compose logs --tail 200 frontend
    docker compose logs --tail 200 backend
    docker compose logs --tail 200 realtime
    docker compose logs --tail 200 rabbitmq

Acceso y pruebas básicas
- Frontend (UI): abrir en el navegador http://localhost:9002
  - Comportamiento clave: la lista de items se obtiene desde el backend y al hacer click en un item se comparte con otras ventanas.
  - Prueba realtime: abre dos pestañas/ventanas en http://localhost:9002 y haz click en un item en una de ellas; la otra pestaña debería recibir la selección y marcar el item.

- Backend API: endpoints relevantes (ejemplos)
  - GET /api/items  -> lista de items (ej: http://localhost:9001/api/items)
  - POST /api/share -> endpoint de fallback para publicar un item (si WS no está disponible)

- Realtime (WebSocket):
  - Dirección por defecto: ws://localhost:3000
  - El servicio `realtime` reenvía mensajes entre clientes WebSocket y también consume mensajes desde RabbitMQ para retransmitirlos.

- RabbitMQ Management UI (opcional): http://localhost:15672  (usuario: guest / pass: guest)
  - Útil para verificar colas (por ejemplo `shared_items`) y mensajes si usas el flujo AMQP.

Estrategia de sincronización entre ventanas
- El frontend abre una conexión WebSocket contra `realtime` y envía mensajes con la forma: { action: 'share_item', item }.
- `realtime` reenvía el mensaje a todos los clientes WebSocket; si hay integración con el backend/RabbitMQ, los mensajes también pueden fluir a través de la cola `shared_items`.
- En la UI, al recibir un mensaje con `action === 'share_item'`, se marca el item y se añade si no existía.

Comandos útiles de depuración
- Volver a levantar un servicio concreto (por ejemplo solo frontend):

    docker compose build --progress=plain --no-cache frontend && docker compose up -d frontend

- Inspeccionar logs en tiempo real:

    docker compose logs -f realtime

- Ejecutar un shell en el contenedor (si necesitas inspeccionar archivos):

    docker compose exec backend sh
    docker compose exec frontend sh

Problemas comunes y soluciones rápidas
- WebSocket no conecta desde el navegador:
  - Verifica que `realtime` esté UP y mapeando el puerto 3000: `docker compose ps`.
  - Revisa `docker compose logs --tail 200 realtime` y la consola del navegador (DevTools -> Console / Network -> WS).
  - Si estás en una red diferente o usas Docker en otra máquina, actualiza la URL WS en la configuración del frontend (`VITE_WS_URL` en build-time o usar un runtime config).

- API /api/items devuelve error:
  - Revisa logs del backend: `docker compose logs --tail 200 backend`.
  - Asegúrate de que el contenedor `backend` pudo inicializar la base de datos (hay un fichero sqlite en backend/database/database.sqlite).

Tecnologías usadas
- Frontend: Vue 3 (Vite), Axios, HTML/CSS simple, desplegado con Nginx en un contenedor.
- Backend: PHP (framework micro/Lumen-style en carpeta `backend`), Composer, SQLite (archivo local) — expone un REST API en /api.
- Realtime: Node.js + ws, consumo/producción AMQP con `amqplib` y conexión a RabbitMQ.
- Mensajería: RabbitMQ (cola `shared_items`) para comunicación entre servicios si es necesario.
- Contenerización: Docker, Docker Compose.

Habilidades aplicadas / demostradas en este proyecto
- Orquestación de contenedores con Docker Compose.
- Diseño de un flujo realtime: WebSockets y AMQP (publicar/consumir con RabbitMQ).
- Integración frontend-backend (SPA consumes REST API y maneja sincronización realtime).
- Manejo de reconexión y tolerancia a fallos en cliente WebSocket (reconnect/backoff).
- Depuración de servicios distribuidos usando logs y herramientas Docker.
- Buenas prácticas en proyecto fullstack: separación de responsabilidades (frontend/backend/realtime), uso de variables de entorno y fallbacks.

Siguientes mejoras recomendadas
- Añadir un endpoint /health para cada servicio y usar healthchecks en Docker Compose para dependencias más robustas.
- Exponer configuración runtime para `VITE_WS_URL` en el contenedor frontend (por ejemplo inyectando un pequeño json en el index.html via Nginx) para evitar rebuilds cuando cambia la URL de realtime.
- Añadir tests e2e simples que abran la UI y verifiquen la sincronización entre dos clientes.

Contacto / notas finales
- Si quieres que aplique alguna de las mejoras (por ejemplo healthchecks, runtime config, o un endpoint /api/share en el backend), dime cuál y la implemento.

---
Archivo editado automáticamente: README.md
