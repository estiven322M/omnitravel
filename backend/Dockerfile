# OmniTravel · backend NestJS — imagen de despliegue (API + proxy Valhalla).
# Multi-stage: compila TypeScript y publica solo dependencias de producción.
#
# Variables de entorno en runtime:
#   PORT            puerto HTTP (por defecto 3000)
#   VALHALLA_URL    URL base del motor de ruteo (por defecto http://localhost:8002)
#   DATABASE_URL    PostgreSQL en AWS RDS (base omnitravel_db)
#   DB_SSL          'true' para RDS
#   JWT_SECRET      secreto de los tokens de sesión
#   DB_SSL_CA       certs/global-bundle.pem (la imagen ya trae la CA de RDS)
#   EVIDENCIAS_BUCKET  bucket de S3 para las fotos de evidencia (en AWS)
#
# En AWS se despliega en Amazon ECS (Express Mode) desde GitHub Actions
# (.github/workflows/despliegue.yml). Ver docs/DESPLIEGUE.md.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# CA pública de AWS RDS para verificar el TLS de la base de datos.
COPY scripts/descargar-ca-rds.mjs ./scripts/descargar-ca-rds.mjs
RUN node scripts/descargar-ca-rds.mjs
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
