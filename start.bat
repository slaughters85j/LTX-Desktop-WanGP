@echo off
REM ============================================================
REM  LTX Desktop — One-stop launcher
REM  Unsets ELECTRON_RUN_AS_NODE (VS Code sets this, breaks Electron)
REM  then launches the full app via pnpm dev.
REM ============================================================

setlocal

cd /d "%~dp0"

REM -- Critical: unset ELECTRON_RUN_AS_NODE or Electron won't load --
set "ELECTRON_RUN_AS_NODE="

REM -- WanGP bridge --
if not defined WANGP_ROOT (
    if exist "C:\pinokio\api\wan.git\app\wgp.py" (
        set "WANGP_ROOT=C:\pinokio\api\wan.git\app"
    )
)

REM -- Extra LoRA directory (shared WanGP ltx2 loras) --
if not defined LTX_EXTRA_LORA_DIR (
    if exist "C:\pinokio\api\wan.git\app\loras\ltx2" (
        set "LTX_EXTRA_LORA_DIR=C:\pinokio\api\wan.git\app\loras\ltx2"
    )
)

REM -- Check pnpm is available --
where pnpm >nul 2>&1
if errorlevel 1 (
    echo ERROR: pnpm not found. Install it with: npm install -g pnpm
    pause
    goto :eof
)

REM -- Install node_modules if missing --
if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
)

echo ============================================================
echo  Starting LTX Desktop
if defined WANGP_ROOT echo  WanGP: %WANGP_ROOT%
echo ============================================================

call pnpm dev

endlocal
