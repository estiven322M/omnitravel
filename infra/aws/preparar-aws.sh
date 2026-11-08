#!/usr/bin/env bash
# =============================================================================
# OmniTravel · preparación de AWS (se ejecuta UNA sola vez en AWS CloudShell)
# =============================================================================
# Crea lo que necesita el despliegue automático desde GitHub Actions:
#   - ECR: repositorio de la imagen Docker del backend.
#   - S3: bucket privado para las fotos de evidencia.
#   - IAM: roles de ECS Express Mode, rol de la tarea (acceso al bucket) y
#     rol que GitHub Actions asume por OIDC (sin claves de acceso guardadas).
#   - Amplify Hosting: aplicación para la versión web (SPA).
# Además revisa la base de datos RDS y la VPC por defecto.
#
# Uso (en CloudShell, en la MISMA región de la base de datos RDS):
#   bash preparar-aws.sh
#
# Es idempotente: si algo ya existe, lo reutiliza.
# =============================================================================
set -euo pipefail

REPO_GITHUB="${REPO_GITHUB:-estiven322M/omnitravel}"
REGION="${AWS_REGION:-$(aws configure get region || true)}"
[ -n "$REGION" ] || { echo "✖ No se detectó la región. Ejecuta: export AWS_REGION=<región de RDS>"; exit 1; }
CUENTA="$(aws sts get-caller-identity --query Account --output text)"

ECR_REPO="omnitravel-backend"
BUCKET="omnitravel-evidencias-${CUENTA}"
ROL_EJECUCION="ecsTaskExecutionRole"
ROL_INFRA="ecsInfrastructureRoleForExpressServices"
ROL_TAREA="omnitravel-backend-task"
ROL_GITHUB="omnitravel-github-deploy"
AMPLIFY_NOMBRE="omnitravel-web"

ok()   { echo "  ✔ $*"; }
info() { echo; echo "▶ $*"; }

echo "Cuenta: $CUENTA · Región: $REGION · Repositorio: $REPO_GITHUB"

# --- 0. Comprobaciones -------------------------------------------------------
info "Base de datos RDS en $REGION"
aws rds describe-db-instances --region "$REGION" \
  --query 'DBInstances[].{Instancia:DBInstanceIdentifier,Motor:Engine,Publica:PubliclyAccessible,Endpoint:Endpoint.Address,VPC:DBSubnetGroup.VpcId,GruposSeguridad:join(`,`,VpcSecurityGroups[].VpcSecurityGroupId)}' \
  --output table || true
if [ "$(aws rds describe-db-instances --region "$REGION" --query 'length(DBInstances)' --output text)" = "0" ]; then
  echo "  ⚠ No hay instancias RDS en $REGION. Cambia de región (arriba a la derecha en CloudShell) y vuelve a ejecutar."
  exit 1
fi

info "VPC por defecto (ECS Express Mode la usa)"
VPC_DEFECTO="$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
if [ "$VPC_DEFECTO" = "None" ]; then
  echo "  ⚠ No hay VPC por defecto. Créala con: aws ec2 create-default-vpc --region $REGION"
  exit 1
fi
ok "VPC por defecto: $VPC_DEFECTO"

info "Reglas de entrada del puerto 5432 en los grupos de seguridad de RDS"
for SG in $(aws rds describe-db-instances --region "$REGION" --query 'DBInstances[].VpcSecurityGroups[].VpcSecurityGroupId' --output text); do
  aws ec2 describe-security-groups --region "$REGION" --group-ids "$SG" \
    --query "SecurityGroups[].IpPermissions[?ToPort==\`5432\`].{Desde:join(\`,\`,IpRanges[].CidrIp),GruposOrigen:join(\`,\`,UserIdGroupPairs[].GroupId)}" \
    --output table || true
done

# --- 1. ECR ------------------------------------------------------------------
info "Repositorio ECR $ECR_REPO"
aws ecr describe-repositories --region "$REGION" --repository-names "$ECR_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --region "$REGION" --repository-name "$ECR_REPO" \
       --image-scanning-configuration scanOnPush=true >/dev/null
aws ecr put-lifecycle-policy --region "$REGION" --repository-name "$ECR_REPO" \
  --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"Conservar 10 imágenes","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":10},"action":{"type":"expire"}}]}' >/dev/null
ok "$CUENTA.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO"

# --- 2. S3 -------------------------------------------------------------------
info "Bucket S3 $BUCKET (privado, cifrado)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
ok "s3://$BUCKET"

# --- 3. Roles de ECS ---------------------------------------------------------
crear_rol() { # nombre servicio-principal
  aws iam get-role --role-name "$1" >/dev/null 2>&1 || aws iam create-role --role-name "$1" \
    --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"$2\"},\"Action\":\"sts:AssumeRole\"}]}" >/dev/null
}

info "Roles de ECS Express Mode"
crear_rol "$ROL_EJECUCION" ecs-tasks.amazonaws.com
aws iam attach-role-policy --role-name "$ROL_EJECUCION" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
crear_rol "$ROL_INFRA" ecs.amazonaws.com
aws iam attach-role-policy --role-name "$ROL_INFRA" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
crear_rol "$ROL_TAREA" ecs-tasks.amazonaws.com
aws iam put-role-policy --role-name "$ROL_TAREA" --policy-name evidencias-s3 --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/evidencia/*\"}]
}"
ok "$ROL_EJECUCION, $ROL_INFRA y $ROL_TAREA"

# --- 4. Acceso de GitHub Actions --------------------------------------------
# Primero OIDC (sin claves). Si la organización de AWS lo prohíbe (política
# SCP), se usa un usuario IAM con claves de acceso guardadas como secretos.
POLITICAS_DESPLIEGUE="AmazonEC2ContainerRegistryPowerUser AmazonECS_FullAccess AdministratorAccess-Amplify"
POLITICA_PASAR_ROLES="{
  \"Version\":\"2012-10-17\",
  \"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":\"iam:PassRole\",\"Resource\":[
      \"arn:aws:iam::$CUENTA:role/$ROL_EJECUCION\",\"arn:aws:iam::$CUENTA:role/$ROL_INFRA\",\"arn:aws:iam::$CUENTA:role/$ROL_TAREA\"]},
    {\"Effect\":\"Allow\",\"Action\":\"iam:CreateServiceLinkedRole\",\"Resource\":\"*\"}
  ]
}"
MODO_GITHUB=""

info "Acceso de GitHub Actions"
OIDC_ARN="arn:aws:iam::$CUENTA:oidc-provider/token.actions.githubusercontent.com"
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1 \
   || aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null 2>&1; then
  CONFIANZA="{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Federated\":\"$OIDC_ARN\"},\"Action\":\"sts:AssumeRoleWithWebIdentity\",
      \"Condition\":{\"StringEquals\":{\"token.actions.githubusercontent.com:aud\":\"sts.amazonaws.com\"},
                     \"StringLike\":{\"token.actions.githubusercontent.com:sub\":\"repo:$REPO_GITHUB:ref:refs/heads/main\"}}}]
  }"
  if aws iam get-role --role-name "$ROL_GITHUB" >/dev/null 2>&1; then
    aws iam update-assume-role-policy --role-name "$ROL_GITHUB" --policy-document "$CONFIANZA"
  else
    aws iam create-role --role-name "$ROL_GITHUB" --assume-role-policy-document "$CONFIANZA" >/dev/null
  fi
  for P in $POLITICAS_DESPLIEGUE; do
    aws iam attach-role-policy --role-name "$ROL_GITHUB" --policy-arn "arn:aws:iam::aws:policy/$P"
  done
  aws iam put-role-policy --role-name "$ROL_GITHUB" --policy-name pasar-roles-ecs --policy-document "$POLITICA_PASAR_ROLES"
  MODO_GITHUB="oidc"
  ok "OIDC: arn:aws:iam::$CUENTA:role/$ROL_GITHUB (solo la rama main de $REPO_GITHUB)"
else
  echo "  ⚠ La organización de AWS no permite OIDC. Se usa un usuario IAM con claves de acceso."
  aws iam get-user --user-name "$ROL_GITHUB" >/dev/null 2>&1 \
    || aws iam create-user --user-name "$ROL_GITHUB" >/dev/null
  for P in $POLITICAS_DESPLIEGUE; do
    aws iam attach-user-policy --user-name "$ROL_GITHUB" --policy-arn "arn:aws:iam::aws:policy/$P"
  done
  aws iam put-user-policy --user-name "$ROL_GITHUB" --policy-name pasar-roles-ecs --policy-document "$POLITICA_PASAR_ROLES"
  MODO_GITHUB="claves"
  ARCHIVO_CLAVES="$HOME/claves-github.txt"
  if [ "$(aws iam list-access-keys --user-name "$ROL_GITHUB" --query 'length(AccessKeyMetadata)' --output text)" = "0" ]; then
    CLAVES="$(aws iam create-access-key --user-name "$ROL_GITHUB" --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)"
    umask 077
    printf 'AWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\n' "$(echo "$CLAVES" | cut -f1)" "$(echo "$CLAVES" | cut -f2)" > "$ARCHIVO_CLAVES"
    NOTA_CLAVES="Claves guardadas en $ARCHIVO_CLAVES (no se muestran aquí)."
  else
    NOTA_CLAVES="El usuario ya tiene una clave. Si la perdiste: IAM → Usuarios → $ROL_GITHUB → borra la clave y vuelve a ejecutar."
  fi
  ok "Usuario IAM $ROL_GITHUB"
fi

# --- 5. Amplify Hosting ------------------------------------------------------
info "Amplify Hosting ($AMPLIFY_NOMBRE)"
APP_ID="$(aws amplify list-apps --region "$REGION" --query "apps[?name=='$AMPLIFY_NOMBRE'].appId | [0]" --output text)"
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID="$(aws amplify create-app --region "$REGION" --name "$AMPLIFY_NOMBRE" --platform WEB \
    --custom-rules '[{"source":"</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|html)$)([^.]+$)/>","target":"/index.html","status":"200"}]' \
    --query app.appId --output text)"
fi
aws amplify get-branch --region "$REGION" --app-id "$APP_ID" --branch-name main >/dev/null 2>&1 \
  || aws amplify create-branch --region "$REGION" --app-id "$APP_ID" --branch-name main --stage PRODUCTION >/dev/null
WEB_URL="https://main.$(aws amplify get-app --region "$REGION" --app-id "$APP_ID" --query app.defaultDomain --output text)"
ok "$WEB_URL"

# --- Resumen -----------------------------------------------------------------
cat <<FIN

=============================================================================
 LISTO. Copia estos valores en GitHub:
 Repositorio → Settings → Secrets and variables → Actions → pestaña «Variables»
=============================================================================
  AWS_REGION          $REGION
  AWS_ACCOUNT_ID      $CUENTA
  EVIDENCIAS_BUCKET   $BUCKET
  AMPLIFY_APP_ID      $APP_ID
  WEB_URL             $WEB_URL

 Y en la pestaña «Secrets»:
  DATABASE_URL        (la misma de backend/.env)
  JWT_SECRET          (texto aleatorio de 48+ caracteres; NO el de desarrollo)
FIN
if [ "$MODO_GITHUB" = "claves" ]; then
cat <<FIN
  AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY
  ${NOTA_CLAVES}
  Para verlas y copiarlas:  cat ~/claves-github.txt
  ⚠ No las pegues en chats ni en el repositorio; solo en GitHub → Secrets.
    Cuando estén en GitHub, borra el archivo:  rm ~/claves-github.txt
FIN
fi
cat <<FIN

 Después: Actions → «Despliegue (AWS)» → Run workflow.
=============================================================================
FIN
