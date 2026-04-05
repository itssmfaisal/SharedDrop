#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  SharedDrop — Build Script (run on YOUR machine)
#  Produces: shareddrop.tar.gz  ready to upload
#            to GitHub Releases
# ─────────────────────────────────────────────

BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'

log()    { echo -e "${CYAN}[build]${RESET} $*"; }
success(){ echo -e "${GREEN}[✔]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[!]${RESET} $*"; }
error()  { echo -e "${RED}[✘]${RESET} $*"; exit 1; }

# ── Must be run from the project root ─────────
[ -f "package.json" ] || error "Run this script from your SharedDrop project root."

# ── Detect config file name ───────────────────
if [ -f "next.config.ts" ]; then
  CONFIG_FILE="next.config.ts"
elif [ -f "next.config.mjs" ]; then
  CONFIG_FILE="next.config.mjs"
elif [ -f "next.config.js" ]; then
  CONFIG_FILE="next.config.js"
else
  error "No next.config.js / next.config.ts / next.config.mjs found."
fi
log "Using config: $CONFIG_FILE"

# ── Ensure output: standalone is present ──────
PATCHED=false
if ! grep -q "standalone" "$CONFIG_FILE" 2>/dev/null; then
  warn "'output: standalone' not found in $CONFIG_FILE — patching temporarily..."

  cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"

  # Works for:  nextConfig = {   and   module.exports = {   and   export default {
  sed -i \
    -e "s/const nextConfig[[:space:]]*=[[:space:]]*{/const nextConfig = {\n  output: 'standalone',/" \
    -e "s/module\.exports[[:space:]]*=[[:space:]]*{/module.exports = {\n  output: 'standalone',/" \
    -e "s/export default[[:space:]]*{/export default {\n  output: 'standalone',/" \
    "$CONFIG_FILE"

  # Verify the patch actually worked
  if ! grep -q "standalone" "$CONFIG_FILE"; then
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE"
    rm -f "${CONFIG_FILE}.bak"
    error "Auto-patch failed. Please add  output: 'standalone'  to $CONFIG_FILE manually and re-run."
  fi

  PATCHED=true
  success "Patched $CONFIG_FILE (original backed up as ${CONFIG_FILE}.bak)"
fi

# ── Restore config on exit (even on error) ────
restore_config() {
  if [ "$PATCHED" = true ] && [ -f "${CONFIG_FILE}.bak" ]; then
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE"
    rm -f "${CONFIG_FILE}.bak"
    log "Restored original $CONFIG_FILE"
  fi
}
trap restore_config EXIT

# ── Clean old build ────────────────────────────
log "Cleaning old build..."
rm -rf .next

# ── Install deps & build ───────────────────────
log "Installing dependencies..."
npm install --legacy-peer-deps

log "Building Next.js standalone..."
npm run build

# ── Verify standalone output was produced ─────
if [ ! -d ".next/standalone" ]; then
  error ".next/standalone was not created.
       The patch may not have taken effect or your build failed.
       Please add  output: 'standalone'  to $CONFIG_FILE manually."
fi

success "Build complete — standalone output verified"

# ── Assemble the distributable bundle ─────────
#
#  Standalone layout after build:
#    .next/standalone/        ← self-contained server + node_modules
#    .next/static/            ← CSS/JS chunks  (copy in manually)
#    public/                  ← static assets  (copy in manually)
#
log "Assembling distribution bundle..."
DIST_DIR=$(mktemp -d /tmp/shareddrop_dist.XXXXXX)
BUNDLE="$DIST_DIR/shareddrop"
mkdir -p "$BUNDLE/.next"

# Core standalone server (includes its own node_modules)
cp -r .next/standalone/. "$BUNDLE/"

# Static Next.js assets (required at runtime)
cp -r .next/static "$BUNDLE/.next/static"

# Public folder (favicons, robots.txt, uploads dir, etc.)
if [ -d "public" ]; then
  cp -r public/. "$BUNDLE/public/"
fi

success "Bundle assembled"

# ── Create tarball ────────────────────────────
OUTPUT="shareddrop.tar.gz"
log "Packaging $OUTPUT..."
tar -czf "$OUTPUT" -C "$DIST_DIR" shareddrop
rm -rf "$DIST_DIR"

SIZE=$(du -sh "$OUTPUT" | cut -f1)
success "Created $OUTPUT ($SIZE)"

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ✅ ${BOLD}Build ready!${RESET}"
echo -e ""
echo -e "  File:  ${CYAN}$(pwd)/$OUTPUT${RESET}"
echo -e "  Size:  ${BOLD}$SIZE${RESET}"
echo -e ""
echo -e "  Next steps:"
echo -e "  1. Go to ${CYAN}https://github.com/itssmfaisal/SharedDrop/releases/new${RESET}"
echo -e "  2. Create a new release tag (e.g. ${BOLD}v1.0.0${RESET})"
echo -e "  3. Upload ${BOLD}$OUTPUT${RESET} as a release asset"
echo -e "  4. Users install with:"
echo -e "     ${YELLOW}curl -fsSL https://raw.githubusercontent.com/itssmfaisal/SharedDrop/main/install.sh | bash${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""