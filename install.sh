#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  SharedDrop — Local Network File Sharing
#  Install & Run Script
# ─────────────────────────────────────────────

REPO_URL="https://github.com/itssmfaisal/SharedDrop.git"
APP_DIR="$HOME/SharedDrop"
DEFAULT_PORT=3000

# ── Colors ────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

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
  Darwin*) PLATFORM="mac" ;;
  *)       error "Unsupported OS: $OS" ;;
esac
log "Detected platform: $PLATFORM"

# ── Check / Install Git ───────────────────────
if ! command -v git &>/dev/null; then
  warn "git not found. Installing..."
  if [ "$PLATFORM" = "linux" ]; then
    sudo apt-get update -qq && sudo apt-get install -y git
  elif [ "$PLATFORM" = "mac" ]; then
    xcode-select --install 2>/dev/null || true
  fi
fi
success "git is available"

# ── Check / Install Node.js (via nvm or system) ──
install_node() {
  warn "Node.js not found or version too old. Installing via nvm..."
  export NVM_DIR="$HOME/.nvm"
  if [ ! -d "$NVM_DIR" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
}

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    install_node
  else
    success "Node.js $(node -v) is available"
  fi
else
  install_node
  success "Node.js $(node -v) installed"
fi

# ── Check npm ─────────────────────────────────
if ! command -v npm &>/dev/null; then
  error "npm not found. Please install Node.js manually from https://nodejs.org"
fi
success "npm $(npm -v) is available"

# ── Clone or Update repo ───────────────────────
if [ -d "$APP_DIR/.git" ]; then
  log "SharedDrop already exists at $APP_DIR. Pulling latest changes..."
  git -C "$APP_DIR" pull --ff-only && success "Repository updated"
else
  log "Cloning SharedDrop into $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
  success "Repository cloned"
fi

cd "$APP_DIR"

# ── Install dependencies ───────────────────────
log "Installing dependencies..."
npm install --legacy-peer-deps
success "Dependencies installed"

# ── Build for production ───────────────────────
log "Building the Next.js app..."
npm run build
success "Build complete"

# ── Determine local IP ────────────────────────
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

# ── Write .env.local ──────────────────────────
cat > "$APP_DIR/.env.local" <<EOF
# Auto-generated by install.sh
HOSTNAME=0.0.0.0
PORT=$PORT
EOF

# ── Launch ────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  🚀 ${BOLD}SharedDrop is starting!${RESET}"
echo -e ""
echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
echo -e ""
echo -e "  Share the ${BOLD}Network${RESET} URL with devices on your Wi-Fi."
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Run on all interfaces so LAN devices can reach it
HOST=0.0.0.0 PORT=$PORT npm start