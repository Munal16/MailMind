# MailMind Production Deployment

MailMind should not be deployed with `npm run dev` or `python manage.py runserver`.

This repository now includes a production deployment path built around:

- Django backend running behind `gunicorn`
- React frontend built with Vite and served by `nginx`
- PostgreSQL database
- Docker Compose orchestration

## Files

- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `backend/.env.production.example`
- `frontend/.env.production.example`

## 1. Prepare backend production environment

Create a file:

```powershell
copy .\backend\.env.production.example .\backend\.env.production
```

Update the values inside `backend/.env.production`:

- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `CORS_ALLOWED_ORIGINS`
- `DB_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FRONTEND_URL`

## 2. Start the production stack

If Docker Desktop is installed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-prod.ps1
```

Or directly:

```powershell
docker compose --env-file .\backend\.env.production -f .\docker-compose.prod.yml up --build -d
```

## 3. Open the app

- frontend + nginx: `http://localhost`
- API root through backend container: `http://localhost/api/`

## 4. Stop the production stack

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-prod.ps1
```

Or directly:

```powershell
docker compose --env-file .\backend\.env.production -f .\docker-compose.prod.yml down
```

## Notes

- The frontend is built once and served statically by `nginx`.
- API calls are proxied from `nginx` to the Django backend.
- Django static files are collected into a shared volume and served by `nginx`.
- This is the correct deployment model for MailMind. The Vite dev server is only for local development.
