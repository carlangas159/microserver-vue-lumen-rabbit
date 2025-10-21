# Etapa de build
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --silent || npm install --silent

# Copiar todo el contexto del build (ya estamos en el directorio correcto: /app)
COPY . .

# Eliminar posibles BOM en archivos que puedan romper parsers (ej. package.json, postcss.config, etc.)
# Esto evita errores como: "Unexpected token \xEF\xBB\xBF in JSON at position 0" durante el build.
RUN find . -type f \( -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.conf' \) -print0 \
  | while IFS= read -r -d '' file; do \
      bom=$(printf '\357\273\277'); \
      sed -i "1s/^$bom//" "$file" || true; \
    done

# Detectar y eliminar BOM de archivos relevantes. Primero listamos archivos con BOM (3 primeros bytes = ef bb bf), luego intentamos limpiar con sed y verificamos de nuevo.
RUN echo "Detectando archivos con BOM (primeros 3 bytes EF BB BF)..." && \
    find . -type f \( -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.conf' -o -name 'postcss.config.*' \) -print0 \
      | while IFS= read -r -d '' file; do \
          bytes=$(od -An -t x1 -N3 "$file" | tr -s ' ' | sed 's/^ //'); \
          if echo "$bytes" | tr '[:upper:]' '[:lower:]' | grep -q "ef bb bf"; then \
            echo "BOM encontrado en: $file -> $bytes"; \
          fi; \
        done && \
    echo "Intentando limpiar BOM en archivos candidatos..." && \
    find . -type f \( -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.conf' -o -name 'postcss.config.*' \) -print0 \
      | while IFS= read -r -d '' file; do \
          bom=$(printf '\357\273\277'); \
          sed -i "1s/^$bom//" "$file" || true; \
        done && \
    echo "Verificando nuevamente archivos con BOM (si aparece algo, falla el build)" && \
    find . -type f \( -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.conf' -o -name 'postcss.config.*' \) -print0 \
      | while IFS= read -r -d '' file; do \
          bytes=$(od -An -t x1 -N3 "$file" | tr -s ' ' | sed 's/^ //'); \
          if echo "$bytes" | tr '[:upper:]' '[:lower:]' | grep -q "ef bb bf"; then \
            echo "ERROR: BOM persistente en: $file -> $bytes"; exit 1; \
          fi; \
        done || true

RUN npm run build

# Etapa runtime con nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Eliminar BOM si existe
RUN bom=$(printf '\357\273\277') && sed -i "1s/^$bom//" /etc/nginx/conf.d/default.conf || true

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
