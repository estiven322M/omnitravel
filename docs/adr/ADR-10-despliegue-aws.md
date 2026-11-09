# ADR-10: Despliegue en Amazon Web Services con CI/CD

- **Estado:** Aceptada e implementada (reemplaza Railway)
- **Fecha de revisión:** 8 de noviembre de 2026

## Contexto
La entrega final exige nube AWS, Google Cloud o Azure; Railway no es válido.

## Decisión
API en Amazon ECS Express Mode (Fargate + ALB con HTTPS), imagen en ECR, web en AWS Amplify Hosting, base en RDS y fotos en S3, región us-east-2. GitHub Actions despliega al fusionar en `main`.

## Alternativas consideradas
App Runner (cerrado a clientes nuevos desde abril de 2026); EC2 administrado a mano; Elastic Beanstalk.

## Justificación
Servicio administrado con HTTPS y escalado mínimo; mismo proveedor que la base.

## Consecuencias
La organización de AWS bloquea OIDC: se usa un usuario IAM de mínimos permisos con claves en GitHub Secrets.

## Evidencia en el repositorio
`.github/workflows/despliegue.yml`, `infra/aws/`, `docs/DESPLIEGUE.md`.
