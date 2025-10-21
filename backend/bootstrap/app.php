<?php

require_once __DIR__.'/../vendor/autoload.php';

$app = new Laravel\Lumen\Application(
    realpath(__DIR__.'/..')
);

$app->withFacades();
$app->withEloquent();

// Carga rutas
$app->router->group([], function ($router) {
    require __DIR__.'/../routes/web.php';
});

return $app;

