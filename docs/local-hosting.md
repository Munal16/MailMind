# MailMind Local Hosting For Friends

This is the simplest way to let someone run MailMind on their own device without starting separate frontend and backend dev servers.

## What this gives you

- React frontend served by `nginx`
- Django backend served by `gunicorn`
- PostgreSQL database in Docker
- One command to start the whole app

This is the right local-hosting option for sharing MailMind with friends.

## Before you start

Each friend should install:

1. `Git`
2. `Git LFS`
3. `Docker Desktop`

Then run once:

```powershell
git lfs install
```

## Clone the project

```powershell
git clone https://github.com/Munal16/MailMind.git
cd MailMind
git lfs pull
```

## Create the localhost config

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-hosting.ps1
```

This creates:

- `backend/.env.localhost`

### If you want Gmail login and Gmail sync

Open `backend/.env.localhost` and set real values for:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Also make sure your Google OAuth app allows these URLs:

- `http://127.0.0.1:8080/api/gmail/callback/`
- `http://localhost:8080/api/gmail/callback/`

And these frontend URLs:

- `http://127.0.0.1:8080`
- `http://localhost:8080`

If you do not add Google credentials, MailMind will still run, but Gmail connect and Google login will not work.

## Start MailMind

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-host.ps1
```

Open:

- `http://127.0.0.1:8080`

## Check status

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-local-host.ps1
```

## Stop MailMind

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-host.ps1
```

## Same Wi-Fi access from your own machine

If you want friends on the same Wi-Fi to use the copy running on your machine:

1. Start MailMind with `start-local-host.ps1`
2. Use the `Same Wi-Fi access` URL shown in the terminal
3. Allow Windows Firewall access if prompted

Important:

- Gmail OAuth over a LAN IP needs matching Google OAuth configuration
- If you do not add the LAN URL to Google OAuth settings, friends can still see the app, but Google login / Gmail connect may fail

## Troubleshooting

### Docker command not found

Install Docker Desktop and open it once before running the script.

### Gmail connect fails

Check:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Google OAuth redirect URIs
- Google OAuth allowed frontend URLs

### The app starts but the models are missing

Run:

```powershell
git lfs pull
```

### Port 8080 is already in use

Edit `backend/.env.localhost` and change:

```env
MAILMIND_HOST_PORT=8081
GOOGLE_REDIRECT_URI=http://127.0.0.1:8081/api/gmail/callback/
FRONTEND_URL=http://127.0.0.1:8081
CSRF_TRUSTED_ORIGINS=http://127.0.0.1:8081,http://localhost:8081
CORS_ALLOWED_ORIGINS=http://127.0.0.1:8081,http://localhost:8081
```

Then restart the stack.
