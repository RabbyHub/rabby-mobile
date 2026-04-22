node_runtime_trace() {
  printf '[node-runtime][trace] %s %s\n' "$(date '+%H:%M:%S')" "$*"
}

ensure_mobile_node_runtime() {
  node_runtime_trace "ensure_mobile_node_runtime start"
  if command -v nvm >/dev/null 2>&1; then
    node_runtime_trace "using existing nvm command"
    nvm use >/dev/null
    return $?
  fi

  nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    node_runtime_trace "source $nvm_dir/nvm.sh"
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    node_runtime_trace "run nvm use"
    nvm use >/dev/null
    return $?
  fi

  if command -v node >/dev/null 2>&1; then
    node_runtime_trace "node already available"
    return 0
  fi

  echo "[node-runtime] node runtime is unavailable" >&2
  return 1
}
