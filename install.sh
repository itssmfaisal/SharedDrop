#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────
#  SharedDrop — Installer (runs on USER's machine)
#  Downloads the pre-built bundle from GitHub
#  Releases and starts the app. No git, no npm
#  install, no build step required.
# ─────────────────────────────────────────────

GITHUB_REPO="itssmfaisal/SharedDrop"
BUNDLE_NAME="shareddrop.tar.gz"
INSTALL_DIR="$HOME/SharedDrop"
DEFAULT_PORT=3000

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
  Darwin*) PLATFORM="mac" ;;
  *)       error "Unsupported OS: $OS" ;;
esac
log "Detected platform: $PLATFORM"

# ── Check Node.js (only runtime needed, no npm build) ─────
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
  if [ "$NODE_VER" -lt 18 ]; then install_node; fi
else
  install_node
fi
success "Node.js $(node -v) is ready"

# ── Resolve latest release download URL ───────
log "Fetching latest release info..."
RELEASE_URL=$(
  curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
  | grep "browser_download_url" \
  | grep "$BUNDLE_NAME" \
  | cut -d '"' -f 4
)

if [ -z "$RELEASE_URL" ]; then
  error "Could not find $BUNDLE_NAME in the latest GitHub release.
       Make sure you have uploaded the build artifact to a GitHub Release."
fi
success "Found release: $RELEASE_URL"

# ── Download bundle ───────────────────────────
TMP_DIR=$(mktemp -d /tmp/shareddrop_install.XXXXXX)
TMP_FILE="$TMP_DIR/$BUNDLE_NAME"

log "Downloading $BUNDLE_NAME..."
curl -fsSL --progress-bar "$RELEASE_URL" -o "$TMP_FILE"
success "Download complete"

# ── Extract ───────────────────────────────────
log "Installing to $INSTALL_DIR..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_FILE" -C "$INSTALL_DIR" --strip-components=1
rm -rf "$TMP_DIR"
success "Installed to $INSTALL_DIR"

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

# ── PID / log file locations ──────────────────
PID_FILE="$INSTALL_DIR/.shareddrop.pid"
LOG_FILE="$INSTALL_DIR/.shareddrop.log"

# ── Stop any existing background instance ─────
stop_background() {
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
      log "Stopping previous background instance (PID $OLD_PID)..."
      kill "$OLD_PID" 2>/dev/null && rm -f "$PID_FILE"
      success "Previous instance stopped"
    else
      rm -f "$PID_FILE"
    fi
  fi
}

# ── Detach: show summary and save PID ─────────
show_detached_message() {
  local pid="$1"
  echo "$pid" > "$PID_FILE"
  disown "$pid" 2>/dev/null || true
  echo ""
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  📦 ${BOLD}SharedDrop detached to background!${RESET}"
  echo -e ""
  echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
  echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
  echo -e ""
  echo -e "  PID:      ${BOLD}$pid${RESET}"
  echo -e "  Logs:     ${BOLD}$LOG_FILE${RESET}"
  echo -e ""
  echo -e "  To view logs:  ${YELLOW}tail -f $LOG_FILE${RESET}"
  echo -e "  To stop:       ${YELLOW}kill \$(cat $PID_FILE)${RESET}"
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

# ── Already running? Offer menu ───────────────
if [ -f "$PID_FILE" ]; then
  RUNNING_PID=$(cat "$PID_FILE")
  if kill -0 "$RUNNING_PID" 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}[!]${RESET} SharedDrop is already running in the background (PID ${BOLD}$RUNNING_PID${RESET})"
    echo -e "    Local:   ${CYAN}http://localhost:${PORT}${RESET}"
    echo -e "    Network: ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
    echo ""
    echo -e "  [${BOLD}R${RESET}] Restart   [${BOLD}S${RESET}] Stop   [${BOLD}Q${RESET}] Quit"
    echo ""

    old_term=$(stty -g </dev/tty 2>/dev/null)
    stty raw -echo </dev/tty 2>/dev/null
    key=$(dd bs=1 count=1 </dev/tty 2>/dev/null)
    stty "$old_term" </dev/tty 2>/dev/null
    echo ""

    case "${key,,}" in
      r) log "Restarting..."; kill "$RUNNING_PID" 2>/dev/null; rm -f "$PID_FILE"; sleep 1 ;;
      s) kill "$RUNNING_PID" 2>/dev/null; rm -f "$PID_FILE"; success "SharedDrop stopped."; exit 0 ;;
      *) log "Exiting without changes."; exit 0 ;;
    esac
  else
    rm -f "$PID_FILE"
  fi
fi

stop_background

# ── Free the port if something else is using it ──
free_port() {
  local port="$1"
  local pid_on_port=""

  if command -v lsof &>/dev/null; then
    pid_on_port=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  elif command -v ss &>/dev/null; then
    pid_on_port=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' || true)
  elif command -v fuser &>/dev/null; then
    pid_on_port=$(fuser "${port}/tcp" 2>/dev/null || true)
  fi

  if [ -n "$pid_on_port" ]; then
    warn "Port $port is in use by PID $pid_on_port — stopping it..."
    kill "$pid_on_port" 2>/dev/null || true
    local i=0
    while [ $i -lt 15 ]; do
      sleep 0.2
      still_used=$(lsof -ti tcp:"$port" 2>/dev/null || ss -tlnp 2>/dev/null | grep -c ":$port " || echo "")
      [ -z "$still_used" ] || [ "$still_used" = "0" ] && break
      i=$((i+1))
    done
    success "Port $port is now free"
  fi
}

free_port "$PORT"

# ── Print running banner ───────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  🚀 ${BOLD}SharedDrop is running!${RESET}"
echo -e ""
echo -e "  Local:    ${CYAN}http://localhost:${PORT}${RESET}"
echo -e "  Network:  ${CYAN}http://${LOCAL_IP}:${PORT}${RESET}"
echo -e ""
echo -e "  Share the ${BOLD}Network${RESET} URL with devices on your Wi-Fi."
echo -e ""
echo -e "  Press ${BOLD}D${RESET} to detach (run in background)"
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Start the standalone server ───────────────
#    next.js standalone builds run via: node server.js
#    stdin </dev/null so Node never owns the terminal.
HOSTNAME=0.0.0.0 PORT=$PORT node "$INSTALL_DIR/server.js" </dev/null &
APP_PID=$!

# Non-interactive (piped) shell — just wait forever
if [ ! -t 1 ]; then
  wait "$APP_PID"
  exit 0
fi

# ── Signal file for keypress communication ────
KEY_SIGNAL=$(mktemp /tmp/shareddrop_key.XXXXXX)

# ── Dedicated key-reader subprocess ──────────
#    Owns /dev/tty exclusively in raw mode.
#    Writes signal to KEY_SIGNAL when D or Q pressed.
(
  old_term=$(stty -g </dev/tty 2>/dev/null)
  stty raw -echo </dev/tty 2>/dev/null
  while true; do
    ch=$(dd bs=1 count=1 </dev/tty 2>/dev/null)
    case "$ch" in
      d|D) printf 'd' > "$KEY_SIGNAL"; break ;;
      q|Q|$'\x03') printf 'q' > "$KEY_SIGNAL"; break ;;
    esac
  done
  stty "$old_term" </dev/tty 2>/dev/null
) &
READER_PID=$!

# ── Ctrl+C handler ────────────────────────────
trap '
  kill "$READER_PID" 2>/dev/null
  wait "$READER_PID" 2>/dev/null
  rm -f "$KEY_SIGNAL"
  echo ""
  log "Stopping SharedDrop..."
  kill "$APP_PID" 2>/dev/null
  wait "$APP_PID" 2>/dev/null
  echo ""
  success "SharedDrop stopped. Goodbye!"
  exit 0
' INT TERM

# ── Poll loop — checks signal file every 0.2 s ─
action=""
while kill -0 "$APP_PID" 2>/dev/null; do
  if [ -s "$KEY_SIGNAL" ]; then
    action=$(cat "$KEY_SIGNAL")
    break
  fi
  sleep 0.2
done

trap - INT TERM
kill "$READER_PID" 2>/dev/null
wait "$READER_PID" 2>/dev/null
rm -f "$KEY_SIGNAL"

case "$action" in
  d)
    log "Detaching to background..."
    kill "$APP_PID" 2>/dev/null
    wait "$APP_PID" 2>/dev/null
    sleep 0.3
    nohup bash -c "HOSTNAME=0.0.0.0 PORT=$PORT node '$INSTALL_DIR/server.js'" \
      > "$LOG_FILE" 2>&1 &
    BG_PID=$!
    show_detached_message "$BG_PID"
    ;;
  q)
    log "Stopping SharedDrop..."
    kill "$APP_PID" 2>/dev/null
    wait "$APP_PID" 2>/dev/null
    success "SharedDrop stopped. Goodbye!"
    exit 0
    ;;
  *)
    warn "SharedDrop exited unexpectedly. Check logs: $LOG_FILE"
    exit 1
    ;;
esac