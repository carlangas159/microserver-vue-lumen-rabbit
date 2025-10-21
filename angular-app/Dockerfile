FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html

# Copiamos los archivos estáticos de la app
COPY . /usr/share/nginx/html

# Copia la configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Asegurar permisos y exponer puerto 80
RUN chmod -R 755 /usr/share/nginx/html || true
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

