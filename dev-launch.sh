#!/bin/bash
# Launch LTX Desktop in dev mode with WanGP bridge enabled.
# Fixes two env issues:
#   1. ELECTRON_RUN_AS_NODE=1 (set by VS Code) breaks Electron module loading
#   2. WANGP_ROOT must be set so the backend enables local generation
unset ELECTRON_RUN_AS_NODE
export WANGP_ROOT="C:\\pinokio\\api\\wan.git\\app"
cd "$(dirname "$0")"
exec pnpm dev
