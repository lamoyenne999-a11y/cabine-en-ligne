# ============================================================
#  Cabine En Ligne — conteneur de production
#  Sert le front PWA + l'API sur un seul port.
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# Front (assemble le build web PWA)
WORKDIR /app
COPY package*.json ./
COPY src ./src
COPY assets ./assets
COPY public ./public
COPY app.json ./
COPY scripts ./scripts
RUN npm install --omit=dev && npm run build:web

# Copier le reste du backend
COPY server/src ./server/src

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Le serveur combiné sert dist/ + /api + /health
CMD ["node", "server/src/combined.js"]
