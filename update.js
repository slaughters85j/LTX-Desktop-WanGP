module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "git pull"
      }
    },
    {
      method: "shell.run",
      params: {
        venv: "backend/.venv",
        path: "backend",
        message: "uv pip install -e . --index-strategy unsafe-best-match"
      }
    }
  ]
}
