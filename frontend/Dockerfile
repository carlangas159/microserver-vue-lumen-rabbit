# Etapa de build
FROM node:18-alpine AS build
WORKDIR /app

# Copia metadatos de paquetes
COPY package*.json ./

# Instalación de dependencias (incluye devDependencies para el build)
RUN npm ci --silent || npm install --silent

# Copia el código fuente y genera el build de producción
COPY . .
RUN npm run build

# Etapa de runtime con nginx
FROM nginx:stable-alpine
# Copiamos los assets de producción
COPY --from=build /app/dist /usr/share/nginx/html
# Configuración nginx (si existe, sobreescribe la default)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Eliminar BOM si existe al inicio del archivo (previene 'unknown directive "\xEF\xBB\xBFserver"')
# Usamos printf con escapes octales para mayor compatibilidad en /bin/sh (Alpine)
RUN bom=$(printf '\357\273\277') && sed -i "1s/^$bom//" /etc/nginx/conf.d/default.conf || true

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
