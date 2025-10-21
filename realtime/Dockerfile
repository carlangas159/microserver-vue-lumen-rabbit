FROM node:18-alpine
WORKDIR /app

# Copia metadatos de paquetes (funciona aunque no exista package-lock.json)
COPY package*.json ./

# Intenta npm ci (si hay lockfile), si falla cae a npm install para producción
RUN npm ci --only=production --silent || npm install --production --no-audit --no-fund --silent

COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
