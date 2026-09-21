ensure_mobile_node_runtime() {
  if command -v nvm >/dev/null 2>&1; then
    nvm use >/dev/null
    return $?
  fi

  nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    nvm use >/dev/null
    return $?
  fi

  if command -v node >/dev/null 2>&1; then
    return 0
  fi

  echo "[node-runtime] node runtime is unavailable" >&2
  return 1
}
