<?php

/**
 * Rutas API mínimas para la demo
 *
 * @var \Laravel\Lumen\Routing\Router $router
 */

/** @noinspection PhpUndefinedVariableInspection */
$router->get('/', function () use ($router) {
    return response()->json(['message' => 'API Lumen en /api']);
});

$router->group(['prefix' => 'api'], function () use ($router) {
    $router->get('items', ['uses' => 'App\\Http\\Controllers\\ItemController@getAll']);
    $router->post('share', ['uses' => 'App\\Http\\Controllers\\ItemController@share']);
});
