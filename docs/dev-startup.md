# MailMind Local Startup

## Why the app sometimes "stops running"

The local frontend and backend are development servers. They only run while their processes are alive.

That means the app will stop if:

- the terminal window is closed
- the machine restarts
- a stale process keeps a port busy
- Vite or Django exits after an error

This is normal for local development. It is not how a production deployment is run.

## Stable local workflow

From the project root, use the scripts in `scripts/` instead of starting services manually.

### Start both servers

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

This will:

- stop stale processes on ports `8000` and `5173`
- run `manage.py check`
- run Django migrations
- start the backend on `http://127.0.0.1:8000/`
- start the frontend on `http://127.0.0.1:5173/`

### Check whether the servers are running

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-dev.ps1
```

### Stop both servers

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-dev.ps1
```

## Production note

For a real deployment, the frontend should be built once and served as static files, and the backend should run under a production server and process manager.

Typical production shape:

- frontend: `npm run build`
- frontend hosting: Nginx, Vercel, Netlify, or Django static serving setup
- backend: Gunicorn/Uvicorn behind a reverse proxy or managed platform
- process management: systemd, Docker, Render, Railway, or similar

So the permanent solution for development is the script-based launcher above.
The permanent solution for deployment is a proper production hosting setup, not a Vite dev server kept open forever.
