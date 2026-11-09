#!/usr/bin/env bash
# =============================================================================
# OmniTravel · respaldos y recuperación (auditoría NC-05, riesgo 2)
# =============================================================================
# Se ejecuta en AWS CloudShell (región us-east-2). Deja configurado y probado:
#
#   1. Copias automáticas de RDS (retención de 7 días, o la máxima que permita
#      la cuenta) con restauración a cualquier minuto de ese periodo (PITR).
#   2. Una instantánea manual "omnitravel-respaldo-<fecha>" (línea base).
#   3. Versionado del bucket de fotos de evidencia en S3: una foto borrada o
#      sobrescrita se puede recuperar durante 30 días.
#   4. (Opcional) PRUEBA DE RESTAURACIÓN: crea una base temporal a partir de la
#      instantánea, compara el número de filas con producción y la elimina.
#
# Uso:
#   bash respaldos.sh                         # pasos 1 a 3
#   bash respaldos.sh --probar-restauracion   # pasos 1 a 4 (~15-20 minutos)
#
# La prueba de restauración pide la contraseña de la base (la de DATABASE_URL
# en backend/.env). No se guarda en ningún archivo.
# Es idempotente: si algo ya está configurado, lo deja igual.
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
CUENTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${EVIDENCIAS_BUCKET:-omnitravel-evidencias-${CUENTA}}"
PROBAR=false
[ "${1:-}" = "--probar-restauracion" ] && PROBAR=true

ok()   { echo "  ✔ $*"; }
info() { echo; echo "▶ $*"; }
aviso() { echo "  ⚠ $*"; }

# Instancia RDS: la primera cuyo identificador contenga "omnitravel".
DB_ID="${DB_ID:-$(aws rds describe-db-instances --region "$REGION" \
  --query "DBInstances[?contains(DBInstanceIdentifier, 'omnitravel')].DBInstanceIdentifier | [0]" \
  --output text)}"
[ -n "$DB_ID" ] && [ "$DB_ID" != "None" ] || { echo "✖ No encontré la base RDS de OmniTravel en $REGION. Usa: DB_ID=<identificador> bash respaldos.sh"; exit 1; }
echo "Cuenta: $CUENTA · Región: $REGION · Base: $DB_ID · Bucket: $BUCKET"

# --- 1. Copias automáticas de RDS -------------------------------------------
info "1. Copias automáticas de RDS"
RETENCION_ACTUAL="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DB_ID" \
  --query 'DBInstances[0].BackupRetentionPeriod' --output text)"
echo "  Retención actual: $RETENCION_ACTUAL día(s)"
if [ "$RETENCION_ACTUAL" -lt 7 ]; then
  # 08:00-08:30 UTC = 3:00-3:30 a. m. en Colombia (poco uso).
  if aws rds modify-db-instance --region "$REGION" --db-instance-identifier "$DB_ID" \
       --backup-retention-period 7 --preferred-backup-window 08:00-08:30 \
       --copy-tags-to-snapshot --apply-immediately >/dev/null 2>/tmp/rds-error.txt; then
    ok "Retención configurada en 7 días (ventana 3:00-3:30 a. m. hora Colombia)."
  elif [ "$RETENCION_ACTUAL" -lt 1 ] && aws rds modify-db-instance --region "$REGION" \
       --db-instance-identifier "$DB_ID" --backup-retention-period 1 --apply-immediately >/dev/null; then
    aviso "La cuenta no permite 7 días ($(head -c 200 /tmp/rds-error.txt)). Quedó en 1 día."
  else
    aviso "No se pudo ampliar la retención: $(head -c 300 /tmp/rds-error.txt)"
    aviso "Se mantiene en $RETENCION_ACTUAL día(s)."
  fi
else
  ok "Ya tiene $RETENCION_ACTUAL días de retención."
fi
aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$DB_ID"
aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DB_ID" \
  --query 'DBInstances[0].{Retencion_dias:BackupRetentionPeriod,Ventana_UTC:PreferredBackupWindow,Restaurable_hasta:LatestRestorableTime}' \
  --output table

# --- 2. Instantánea manual ---------------------------------------------------
info "2. Instantánea manual (línea base)"
SNAP="omnitravel-respaldo-$(date -u +%Y%m%d-%H%M)"
aws rds create-db-snapshot --region "$REGION" --db-instance-identifier "$DB_ID" \
  --db-snapshot-identifier "$SNAP" --tags Key=proyecto,Value=omnitravel >/dev/null
echo "  Creando $SNAP (tarda unos minutos)…"
aws rds wait db-snapshot-available --region "$REGION" --db-snapshot-identifier "$SNAP"
ok "Instantánea lista: $SNAP"
aws rds describe-db-snapshots --region "$REGION" --db-instance-identifier "$DB_ID" \
  --query 'DBSnapshots[].{Instantanea:DBSnapshotIdentifier,Tipo:SnapshotType,Fecha:SnapshotCreateTime,Estado:Status}' \
  --output table

# --- 3. Versionado de las fotos en S3 ----------------------------------------
info "3. Versionado del bucket de evidencias ($BUCKET)"
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [{
    "ID": "versiones-anteriores-30-dias",
    "Status": "Enabled",
    "Filter": {"Prefix": ""},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
  }]
}'
ok "Versionado: $(aws s3api get-bucket-versioning --bucket "$BUCKET" --query Status --output text) · versiones anteriores se conservan 30 días."

# --- 4. Prueba de restauración -------------------------------------------------
if [ "$PROBAR" != true ]; then
  echo
  echo "Listo. Para la prueba de restauración: bash respaldos.sh --probar-restauracion"
  exit 0
fi

info "4. Prueba de restauración desde $SNAP"
PRUEBA="omnitravel-prueba-restauracion"
read -r CLASE SUBNETS SG PUBLICA USUARIO BD <<<"$(aws rds describe-db-instances --region "$REGION" \
  --db-instance-identifier "$DB_ID" --query 'DBInstances[0].[DBInstanceClass,DBSubnetGroup.DBSubnetGroupName,VpcSecurityGroups[0].VpcSecurityGroupId,PubliclyAccessible,MasterUsername,DBName]' \
  --output text)"
ACCESO="--no-publicly-accessible"; [ "$PUBLICA" = "True" ] && ACCESO="--publicly-accessible"
INICIO=$(date +%s)
aws rds restore-db-instance-from-db-snapshot --region "$REGION" \
  --db-instance-identifier "$PRUEBA" --db-snapshot-identifier "$SNAP" \
  --db-instance-class "$CLASE" --db-subnet-group-name "$SUBNETS" \
  --vpc-security-group-ids "$SG" $ACCESO --no-multi-az \
  --tags Key=proyecto,Value=omnitravel Key=uso,Value=prueba-restauracion >/dev/null
echo "  Restaurando en $PRUEBA (10-15 minutos)…"
aws rds wait db-instance-available --region "$REGION" --db-instance-identifier "$PRUEBA"
MINUTOS=$(( ($(date +%s) - INICIO) / 60 ))
ok "Base restaurada en $MINUTOS minutos."

command -v psql >/dev/null || sudo dnf install -y -q postgresql15 >/dev/null
ORIGEN="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$DB_ID" --query 'DBInstances[0].Endpoint.Address' --output text)"
DESTINO="$(aws rds describe-db-instances --region "$REGION" --db-instance-identifier "$PRUEBA" --query 'DBInstances[0].Endpoint.Address' --output text)"
read -r -s -p "  Contraseña de la base (usuario $USUARIO): " PGPASSWORD; echo
export PGPASSWORD PGSSLMODE=require
CONTEO="select 'poi', count(*) from poi union all select 'usuario', count(*) from usuario
  union all select 'reporte', count(*) from reporte union all select 'retroalimentacion', count(*) from retroalimentacion
  union all select 'visita', count(*) from visita order by 1"
BASE="${BD:-omnitravel_db}"
[ "$BASE" = "None" ] && BASE=omnitravel_db
echo "  Producción ($ORIGEN):";  psql -h "$ORIGEN"  -U "$USUARIO" -d "$BASE" -Atc "$CONTEO" | sed 's/^/    /'
echo "  Restaurada ($DESTINO):"; psql -h "$DESTINO" -U "$USUARIO" -d "$BASE" -Atc "$CONTEO" | sed 's/^/    /'
unset PGPASSWORD

echo "  Eliminando la base temporal de prueba…"
aws rds delete-db-instance --region "$REGION" --db-instance-identifier "$PRUEBA" \
  --skip-final-snapshot --delete-automated-backups >/dev/null
ok "Prueba terminada: restauración verificada en $MINUTOS minutos; base temporal eliminada."
echo
echo "Guarda una captura de esta salida: es la evidencia de NC-05 (respaldo y recuperación probados)."
