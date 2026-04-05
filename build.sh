#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  SharedDrop — Build Script (run on YOUR machine)
#  Builds, packages, and publishes to GitHub
#  Releases automatically — no browser needed.
# ─────────────────────────────────────────────

BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'

GITHUB_REPO="itssmfaisal/SharedDrop"
BUNDLE_NAME="shareddrop.tar.gz"

log()    { echo -e "${CYAN}[build]${RESET} $*"; }
success(){ echo -e "${GREEN}[✔]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[!]${RESET} $*"; }
error()  { echo -e "${RED}[✘]${RESET} $*"; exit 1; }

# ── Must be run from the project root ─────────
[ -f "package.json" ] || error "Run this script from your SharedDrop project root."

# ── Step 1: Check / Install GitHub CLI ────────
echo ""
echo -e "${BOLD}${CYAN}── Step 1: GitHub CLI ───────────────────────${RESET}"

install_gh() {
  warn "GitHub CLI (gh) not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      brew install gh
    else
      error "Homebrew not found. Install gh manually: https://cli.github.com"
    fi
  elif [[ "$OSTYPE" == "linux"* ]]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
      https://cli.github.com/packages stable main" \
      | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt-get update -qq && sudo apt-get install -y gh
  else
    error "Cannot auto-install gh on this OS. Install from: https://cli.github.com"
  fi
}

if ! command -v gh &>/dev/null; then
  install_gh
fi
success "gh $(gh --version | head -1 | awk '{print $3}') is available"

# ── Step 2: GitHub auth ────────────────────────
echo ""
echo -e "${BOLD}${CYAN}── Step 2: GitHub Auth ──────────────────────${RESET}"

if ! gh auth status &>/dev/null; then
  warn "Not logged in to GitHub. Starting login..."
  echo ""
  echo -e "  A browser window will open — log in and authorize the CLI."
  echo -e "  If no browser opens, follow the URL shown in the terminal."
  echo ""
  gh auth login --web --git-protocol https
fi
success "GitHub auth OK ($(gh api user --jq '.login'))"

# ── Step 3: Ask for version tag ───────────────
echo ""
echo -e "${BOLD}${CYAN}── Step 3: Release Version ──────────────────${RESET}"

# Get the latest existing tag to suggest next version
LATEST_TAG=$(gh release list --repo "$GITHUB_REPO" --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null || echo "")

if [ -n "$LATEST_TAG" ]; then
  # Auto-increment patch version  (v1.0.3 → v1.0.4)
  BASE=$(echo "$LATEST_TAG" | sed 's/^v//')
  MAJOR=$(echo "$BASE" | cut -d. -f1)
  MINOR=$(echo "$BASE" | cut -d. -f2)
  PATCH=$(echo "$BASE" | cut -d. -f3)
  SUGGESTED="v${MAJOR}.${MINOR}.$((PATCH + 1))"
  echo -e "  Latest release: ${YELLOW}$LATEST_TAG${RESET}"
else
  SUGGESTED="v1.0.0"
  echo -e "  No previous releases found."
fi

echo -e "  Suggested tag:  ${BOLD}$SUGGESTED${RESET}"
echo ""
read -rp "  Enter version tag [press Enter for $SUGGESTED]: " INPUT_TAG
VERSION="${INPUT_TAG:-$SUGGESTED}"
# Ensure it starts with v
[[ "$VERSION" == v* ]] || VERSION="v$VERSION"
echo ""
log "Building release: $VERSION"

# ── Step 4: Patch next.config for standalone ──
echo ""
echo -e "${BOLD}${CYAN}── Step 4: Next.js Config ───────────────────${RESET}"

if [ -f "next.config.ts" ]; then
  CONFIG_FILE="next.config.ts"
elif [ -f "next.config.mjs" ]; then
  CONFIG_FILE="next.config.mjs"
elif [ -f "next.config.js" ]; then
  CONFIG_FILE="next.config.js"
else
  error "No next.config.js / .ts / .mjs found."
fi
log "Config file: $CONFIG_FILE"

PATCHED=false
if ! grep -q "standalone" "$CONFIG_FILE" 2>/dev/null; then
  cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
  sed -i \
    -e "s/const nextConfig[[:space:]]*=[[:space:]]*{/const nextConfig = {\n  output: 'standalone',/" \
    -e "s/module\.exports[[:space:]]*=[[:space:]]*{/module.exports = {\n  output: 'standalone',/" \
    -e "s/export default[[:space:]]*{/export default {\n  output: 'standalone',/" \
    "$CONFIG_FILE"

  if ! grep -q "standalone" "$CONFIG_FILE"; then
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE" && rm -f "${CONFIG_FILE}.bak"
    error "Auto-patch failed. Add  output: 'standalone'  to $CONFIG_FILE manually."
  fi
  PATCHED=true
  success "Patched $CONFIG_FILE with output: standalone"
else
  success "output: standalone already present"
fi

# Always restore config on exit
restore_config() {
  if [ "$PATCHED" = true ] && [ -f "${CONFIG_FILE}.bak" ]; then
    cp "${CONFIG_FILE}.bak" "$CONFIG_FILE"
    rm -f "${CONFIG_FILE}.bak"
    log "Restored original $CONFIG_FILE"
  fi
}
trap restore_config EXIT

# ── Step 5: Build ──────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}── Step 5: Build ────────────────────────────${RESET}"

log "Cleaning old build..."
rm -rf .next

log "Installing dependencies..."
npm install --legacy-peer-deps

log "Building Next.js standalone..."
npm run build

[ -d ".next/standalone" ] || error ".next/standalone was not created. Check your build output."
success "Build complete — standalone output verified"

# ── Step 6: Package ───────────────────────────
echo ""
echo -e "${BOLD}${CYAN}── Step 6: Package ──────────────────────────${RESET}"

log "Assembling bundle..."
DIST_DIR=$(mktemp -d /tmp/shareddrop_dist.XXXXXX)
BUNDLE="$DIST_DIR/shareddrop"
mkdir -p "$BUNDLE/.next"

cp -r .next/standalone/. "$BUNDLE/"
cp -r .next/static       "$BUNDLE/.next/static"
[ -d "public" ] && cp -r public/. "$BUNDLE/public/"

log "Creating $BUNDLE_NAME..."
tar -czf "$BUNDLE_NAME" -C "$DIST_DIR" shareddrop
rm -rf "$DIST_DIR"

SIZE=$(du -sh "$BUNDLE_NAME" | cut -f1)
success "Packaged $BUNDLE_NAME ($SIZE)"

# ── Step 7: Publish to GitHub Releases ────────
echo ""
echo -e "${BOLD}${CYAN}── Step 7: Publish to GitHub ────────────────${RESET}"

log "Creating GitHub release $VERSION and uploading $BUNDLE_NAME..."
gh release create "$VERSION" "$BUNDLE_NAME" \
  --repo "$GITHUB_REPO" \
  --title "SharedDrop $VERSION" \
  --notes "## SharedDrop $VERSION

Pre-built release. Install on any machine with:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash
\`\`\`"

rm -f "$BUNDLE_NAME"
success "Published release $VERSION"

# ── Done ──────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  🎉 ${BOLD}SharedDrop $VERSION is live!${RESET}"
echo -e ""
echo -e "  Release: ${CYAN}https://github.com/$GITHUB_REPO/releases/tag/$VERSION${RESET}"
echo -e ""
echo -e "  Users install with:"
echo -e "  ${YELLOW}curl -fsSL https://raw.githubusercontent.com/$GITHUB_REPO/main/install.sh | bash${RESET}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""