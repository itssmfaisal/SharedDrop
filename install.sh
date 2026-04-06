#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  SharedDrop — Installer
#  curl -fsSL https://raw.githubusercontent.com/
#    itssmfaisal/SharedDrop/main/install.sh | bash
# ─────────────────────────────────────────────

GITHUB_REPO="itssmfaisal/SharedDrop"
BUNDLE_NAME="shareddrop.tar.gz"
INSTALL_DIR="$HOME/SharedDrop"
APP_NAME="shareddrop"
DEFAULT_PORT=5000

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()    { echo -e "${CYAN}[SharedDrop]${RESET} $*"; }
success(){ echo -e "${GREEN}[✔]${RESET} $*"; }
warn()   { echo -e "${YELLOW}[!]${RESET} $*"; }
error()  { echo -e "${RED}[✘]${RESET} $*"; exit 1; }

# ── Banner ────────────────────────────────────
echo -e "${BOLD}"
echo "  ███████╗██╗  ██╗ █████╗ ██████╗ ███████╗██████╗ ██████╗  ██████╗ ██████╗ "
echo "  ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗"
echo "  ███████╗███████║███████║██████╔╝█████╗  ██║  ██║██║  ██║██║   ██║██████╔╝"
echo "  ╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  ██║  ██║██║  ██║██║   ██║██╔═══╝ "
echo "  ███████║██║  ██║██║  ██║██║  ██║███████╗██████╔╝██████╔╝╚██████╔╝██║     "
echo "  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝ ╚═════╝  ╚═════╝ ╚═╝     "
echo -e "${RESET}"
echo -e "  ${BOLD}Local Network File Sharing — by itssmfaisal${RESET}"
echo "  ─────────────────────────────────────────────"
echo ""

# ── Detect OS ─────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="mac"   ;;
  *)       error "Unsupported OS: $OS" ;;
esac
log "Detected platform: $PLATFORM"

# ── Check / install Node.js ───────────────────
install_node() {
  warn "Node.js 18+ not found. Installing via nvm..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install --lts && nvm use --lts
}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  [ "$NODE_VER" -lt 18 ] && install_node
else
  install_node
fi
success "Node.js $(node -v) is ready"

# ── Check / install pm2 ───────────────────────
if ! command -v pm2 &>/dev/null; then
  log "Installing pm2..."
  npm install -g pm2 --silent
fi
success "pm2 $(pm2 --version) is ready"

# ── Resolve latest GitHub release URL ─────────
log "Fetching latest release info..."
RELEASE_URL=$(
  curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
  | grep "browser_download_url" \
  | grep "$BUNDLE_NAME" \
  | cut -d '"' -f 4
)
[ -z "$RELEASE_URL" ] && error "Could not find $BUNDLE_NAME in the latest GitHub release."
success "Found release: $RELEASE_URL"

# ── Download ──────────────────────────────────
TMP_DIR=$(mktemp -d /tmp/shareddrop_install.XXXXXX)
log "Downloading $BUNDLE_NAME..."
curl -fsSL --progress-bar "$RELEASE_URL" -o "$TMP_DIR/$BUNDLE_NAME"
success "Download complete"

# ── Stop existing pm2 instance if running ─────
if pm2 describe "$APP_NAME" &>/dev/null; then
  log "Stopping existing SharedDrop instance..."
  pm2 delete "$APP_NAME" --silent 2>/dev/null || true
  success "Stopped existing instance"
fi

# ── Extract ───────────────────────────────────
log "Installing to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_DIR/$BUNDLE_NAME" -C "$INSTALL_DIR" --strip-components=1
rm -rf "$TMP_DIR"
success "Installed to $INSTALL_DIR"

# ── Detect local IP ───────────────────────────
get_local_ip() {
  if [ "$PLATFORM" = "mac" ]; then
    ipconfig getifaddr en0 2>/dev/null \
      || ipconfig getifaddr en1 2>/dev/null \
      || echo "127.0.0.1"
  else
    hostname -I 2>/dev/null | awk '{print $1}' \
      || ip route get 1 2>/dev/null | awk '{print $NF; exit}' \
      || echo "127.0.0.1"
  fi
}

LOCAL_IP=$(get_local_ip)
PORT="${SHAREDDROP_PORT:-$DEFAULT_PORT}"

# ── If script is piped (curl | bash) run in background via pm2 immediately ──
if [ ! -t 1 ]; then
  log "Non-interactive shell detected — starting with pm2..."
  HOSTNAME=0.0.0.0 PORT=$PORT pm2 start "$INSTALL_DIR/server.js" \
    --name "$APP_NAME" \
    --no-autorestart \
    -- --hostname 0.0.0.0 --port "$PORT" 2>/dev/null || \
  pm2 start "$INSTALL_DIR/server.js" --name "$APP_NAME"

  pm2 save --force &>/dev/null || true
  echo ""
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  🚀 ${BOLD}SharedDrop is running via pm2!${RESET}"
  echo -e ""
  echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
  echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
  echo -e ""
  echo -e "  Useful commands:"
  echo -e "  ${YELLOW}pm2 logs $APP_NAME${RESET}      — view logs"
  echo -e "  ${YELLOW}pm2 stop $APP_NAME${RESET}      — stop"
  echo -e "  ${YELLOW}pm2 restart $APP_NAME${RESET}   — restart"
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  exit 0
fi

# ── Interactive: ask user what they want ──────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ✅ ${BOLD}SharedDrop installed!${RESET}"
echo -e ""
echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
echo -e ""
echo -e "  How would you like to run it?"
echo -e ""
echo -e "  [${BOLD}F${RESET}] Foreground  — see logs in terminal (Ctrl+C to stop)"
echo -e "  [${BOLD}B${RESET}] Background  — run silently via pm2"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

old_term=$(stty -g </dev/tty 2>/dev/null)
stty raw -echo </dev/tty 2>/dev/null
key=$(dd bs=1 count=1 </dev/tty 2>/dev/null)
stty "$old_term" </dev/tty 2>/dev/null
echo ""

case "${key,,}" in
  b)
    # ── Background via pm2 ─────────────────────
    log "Starting SharedDrop in background via pm2..."
    HOSTNAME=0.0.0.0 PORT=$PORT pm2 start "$INSTALL_DIR/server.js" \
      --name "$APP_NAME"
    pm2 save --force &>/dev/null || true

    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  📦 ${BOLD}SharedDrop is running in background!${RESET}"
    echo -e ""
    echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
    echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
    echo -e ""
    echo -e "  Useful commands:"
    echo -e "  ${YELLOW}pm2 logs $APP_NAME${RESET}      — view logs"
    echo -e "  ${YELLOW}pm2 stop $APP_NAME${RESET}      — stop"
    echo -e "  ${YELLOW}pm2 restart $APP_NAME${RESET}   — restart"
    echo -e "  ${YELLOW}pm2 monit${RESET}               — live dashboard"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    ;;

  *)
    # ── Foreground ─────────────────────────────
    log "Starting SharedDrop in foreground..."
    echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
    echo ""
    HOSTNAME=0.0.0.0 PORT=$PORT node "$INSTALL_DIR/server.js"
    ;;
esac
