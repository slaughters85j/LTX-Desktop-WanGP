module.exports = async (kernel) => {
  let port = await kernel.port()
  return {
    daemon: true,
    run: [
      {
        method: "shell.run",
        params: {
          venv: "backend/.venv",
          env: {
            LTX_PORT: port,
            LTX_APP_DATA_DIR: "{{path.join(cwd, 'data')}}",
            WANGP_ROOT: "{{path.resolve(cwd, '..', 'wan.git', 'app')}}",
            PYTHONUNBUFFERED: "1",
          },
          path: "backend",
          message: [
            "python -u ltx2_server.py"
          ],
          on: [{
            "event": "/http:\\/\\/[0-9.:]+/",
            "done": true
          }]
        }
      },
      {
        method: "local.set",
        params: {
          url: "{{input.event[0]}}"
        }
      }
    ]
  }
}
