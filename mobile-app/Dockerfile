# OmniTravel · versión web (Railway usa este Dockerfile automáticamente).
# 1) Exporta la app web estática con Expo; 2) la sirve con un servidor Node
#    mínimo (scripts/servir-web.mjs) en el puerto $PORT.
#
# Variable de build (Railway la pasa como ARG):
#   EXPO_PUBLIC_API_URL  URL del backend, p. ej. https://omnitravel-production-4af6.up.railway.app

FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN test -n "$EXPO_PUBLIC_API_URL" || (echo "Falta EXPO_PUBLIC_API_URL" && exit 1)
RUN npx expo export -p web

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY scripts/servir-web.mjs ./scripts/servir-web.mjs
EXPOSE 8080
CMD ["node", "scripts/servir-web.mjs"]
