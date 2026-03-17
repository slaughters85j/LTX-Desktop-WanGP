module.exports = {
  run: [
    {
      when: "{{gpu === 'amd' || platform === 'darwin'}}",
      method: "notify",
      params: {
        html: "This app requires an NVIDIA GPU. Not compatible with AMD GPUs and macOS."
      },
      next: null
    },
    {
      method: "shell.run",
      params: {
        path: "backend",
        message: [
          "uv venv .venv --python 3.12",
        ]
      }
    },
    {
      method: "shell.run",
      params: {
        venv: "backend/.venv",
        path: "backend",
        message: [
          "uv pip install -e . --index-strategy unsafe-best-match",
        ]
      }
    },
    {
      method: "shell.run",
      params: {
        message: [
          "mkdir -p data/models data/outputs",
        ]
      }
    },
    {
      method: 'input',
      params: {
        title: 'Installation completed',
        description: 'Click "Start" to launch the LTX Desktop backend.'
      }
    }
  ]
}
