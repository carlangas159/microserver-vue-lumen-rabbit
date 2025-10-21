<?php

namespace App\Http\Controllers;

use Laravel\Lumen\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use GuzzleHttp\Client;

/**
 * Controlador para administrar Items.
 * - `getAll` devuelve la lista de items (usa cache SQLite local, refresca desde API pública si está vacío o forzado).
 * - `share` publica un mensaje en la cola RabbitMQ para que el servicio realtime lo difunda.
 */
class ItemController extends BaseController
{
    private string $dbPath;

    public function __construct()
    {
        // Ruta relativa al directorio de la aplicación
        $this->dbPath = base_path('database/database.sqlite');
        // Asegurar la tabla exista
        $this->ensureTable();
    }

    /**
     * Asegura que la tabla `items` exista en la base de datos SQLite.
     *
     * Ejemplos de uso (en español):
     * 1) Al instanciar el controlador se crea la tabla si no existe.
     * 2) Se llama implícitamente antes de leer/escribir items.
     * 3) Útil para entornos donde la DB se monta en contenedor.
     */
    private function ensureTable(): void
    {
        $pdo = new \PDO('sqlite:' . $this->dbPath);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $pdo->exec("CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY,
            remote_id INTEGER UNIQUE,
            title TEXT,
            url TEXT,
            thumbnailUrl TEXT,
            cached_at INTEGER
        )");
    }

    /**
     * Devuelve todos los items en cache o los recarga desde la API pública.
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * Ejemplos de uso (en español):
     * 1) GET /api/items -> devuelve items cacheados o los descarga si la cache está vacía.
     * 2) GET /api/items?refresh=1 -> fuerza la recarga desde la API pública.
     * 3) Usar desde el frontend para mostrar listado de imágenes y títulos.
     */
    public function getAll(Request $request)
    {
        $refresh = $request->query('refresh', 0);
        $pdo = new \PDO('sqlite:' . $this->dbPath);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        // Si refresh forzado, limpiar cache
        if ($refresh) {
            $pdo->exec("DELETE FROM items");
        }

        $stmt = $pdo->query('SELECT id, remote_id, title, url, thumbnailUrl, cached_at FROM items ORDER BY id DESC');
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        if (!$rows) {
            // Obtener desde API pública y guardar
            $client = new Client(['timeout' => 10]);
            // Usamos un endpoint con imágenes: JSONPlaceholder photos (limitar a 30)
            $res = $client->get('https://jsonplaceholder.typicode.com/photos?_limit=30');
            $data = json_decode($res->getBody()->getContents(), true);

            $insert = $pdo->prepare('INSERT OR IGNORE INTO items (remote_id, title, url, thumbnailUrl, cached_at) VALUES (:remote_id, :title, :url, :thumbnailUrl, :cached_at)');
            $now = time();
            foreach ($data as $item) {
                $insert->execute([
                    ':remote_id' => $item['id'],
                    ':title' => $item['title'] ?? '',
                    ':url' => $item['url'] ?? '',
                    ':thumbnailUrl' => $item['thumbnailUrl'] ?? '',
                    ':cached_at' => $now
                ]);
            }

            $stmt = $pdo->query('SELECT id, remote_id, title, url, thumbnailUrl, cached_at FROM items ORDER BY id DESC');
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        }

        return response()->json($rows);
    }

    /**
     * Recibe una imagen (URL o base64) y publica un mensaje en la cola `shared_items`.
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * Ejemplos de uso (en español):
     * 1) POST /api/share { "url": "https://..." } -> publicará la URL en la cola para difusión.
     * 2) POST /api/share { "image_base64": "data:image/png;base64,..." } -> publicará la imagen en base64.
     * 3) Usar desde el frontend al seleccionar un archivo: enviar la URL o el base64 al endpoint.
     */
    public function share(Request $request)
    {
        $payload = [];
        if ($request->has('url')) {
            $payload['type'] = 'url';
            $payload['url'] = $request->input('url');
        } elseif ($request->has('image_base64')) {
            $payload['type'] = 'base64';
            $payload['image_base64'] = $request->input('image_base64');
        } else {
            return response()->json(['error' => 'Se requiere url o image_base64'], 400);
        }

        // Publicar en RabbitMQ usando php-amqplib
        try {
            $connection = new \PhpAmqpLib\Connection\AMQPStreamConnection(
                env('RABBITMQ_HOST', 'rabbitmq'),
                (int)env('RABBITMQ_PORT', 5672),
                env('RABBITMQ_DEFAULT_USER', 'guest'),
                env('RABBITMQ_DEFAULT_PASS', 'guest')
            );
            $channel = $connection->channel();
            $channel->queue_declare('shared_items', false, true, false, false);
            $msgBody = json_encode($payload);
            $msg = new \PhpAmqpLib\Message\AMQPMessage($msgBody, ['delivery_mode' => 2]);
            $channel->basic_publish($msg, '', 'shared_items');
            $channel->close();
            $connection->close();
        } catch (\Exception $e) {
            return response()->json(['error' => 'No se pudo publicar en la cola', 'details' => $e->getMessage()], 500);
        }

        return response()->json(['status' => 'ok']);
    }
}

