FROM php:8.1-fpm

# Instala extensiones necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libzip-dev \
    libpq-dev \
    libicu-dev \
    libonig-dev \
    sqlite3 \
    libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite zip bcmath sockets

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copia y prepara dependencias
COPY composer.json composer.lock* ./

# Configuración de Composer en build para evitar fallos por memoria y permitir ejecución como root
ENV COMPOSER_ALLOW_SUPERUSER=1
ENV COMPOSER_MEMORY_LIMIT=-1

# Instala dependencias PHP (fallará si composer.json es inválido — preferible a ocultarlo)
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Copia el resto del código
COPY . ./

# Crea carpeta de base de datos si no existe
RUN mkdir -p database && touch database/database.sqlite && chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["php", "-S", "0.0.0.0:80", "-t", "public"]
