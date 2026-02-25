# Deploying Speldo to Render.com

This guide walks you through deploying the Speldo game (Django backend + Next.js frontend) to Render.com.

## Prerequisites

1. A [Render.com](https://render.com) account
2. Your code pushed to a GitHub or GitLab repository
3. The repository must be connected to your Render account

## Option 1: Deploy Using Blueprint (Recommended)

The `render.yaml` file contains all the infrastructure configuration. This is the easiest way to deploy.

### Steps:

1. **Push your code to GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Click **"New"** → **"Blueprint"**

3. **Connect Your Repository**
   - Select your repository containing the `render.yaml` file
   - Render will automatically detect the blueprint

4. **Configure Environment Variables**
   - Render will show you the services to be created
   - For the backend service, you need to add:
     - `SECRET_KEY`: Generate a secure key (use `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
   - The `DATABASE_URL`, `REDIS_URL`, and `FRONTEND_URL` are automatically set by the blueprint

5. **Deploy**
   - Click **"Apply"** to create all services
   - Wait for all services to deploy (this may take 5-10 minutes)

6. **Update Frontend Environment**
   - After backend is deployed, note the backend URL (e.g., `https://speldo-backend.onrender.com`)
   - Go to your frontend service settings
   - Update environment variables:
     - `NEXT_PUBLIC_API_URL`: `https://speldo-backend.onrender.com`
     - `NEXT_PUBLIC_WS_URL`: `wss://speldo-backend.onrender.com`

---

## Option 2: Manual Deployment

If you prefer to set up services individually:

### Step 1: Create PostgreSQL Database

1. Go to Render Dashboard → **"New"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `speldo-db`
   - **Database**: `speldo`
   - **User**: `speldo`
   - **Region**: Choose closest to your users
   - **Plan**: Free (or paid for better performance)
3. Click **"Create Database"**
4. Copy the **Internal Database URL** for later

### Step 2: Create Redis Instance

1. Go to **"New"** → **"Redis"**
2. Configure:
   - **Name**: `speldo-redis`
   - **Plan**: Free (or paid)
3. Click **"Create Redis"**
4. Copy the **Internal Redis URL** for later

### Step 3: Deploy Backend

1. Go to **"New"** → **"Web Service"**
2. Connect your repository
3. Configure:
   - **Name**: `speldo-backend`
   - **Region**: Same as database
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `daphne -b 0.0.0.0 -p $PORT splendor.asgi:application`

4. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `SECRET_KEY` | Generate a secure key |
   | `DEBUG` | `False` |
   | `DATABASE_URL` | (Internal Database URL from Step 1) |
   | `REDIS_URL` | (Internal Redis URL from Step 2) |
   | `FRONTEND_URL` | `https://speldo-frontend.onrender.com` |
   | `PYTHON_VERSION` | `3.11.4` |

5. Click **"Create Web Service"**

### Step 4: Deploy Frontend

1. Go to **"New"** → **"Web Service"**
2. Connect your repository
3. Configure:
   - **Name**: `speldo-frontend`
   - **Region**: Same as backend
   - **Root Directory**: `frontend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://speldo-backend.onrender.com` |
   | `NEXT_PUBLIC_WS_URL` | `wss://speldo-backend.onrender.com` |
   | `NODE_VERSION` | `20.10.0` |

5. Click **"Create Web Service"**

---

## Post-Deployment Setup

### 1. Create Admin User

After deployment, create a Django superuser to access the admin panel:

1. Go to your backend service on Render
2. Click **"Shell"** tab
3. Run:
   ```bash
   python manage.py createsuperuser
   ```
4. Follow the prompts to create your admin account

### 2. Access Admin Panel

- Visit: `https://speldo-backend.onrender.com/admin/`
- Login with your superuser credentials
- You can manage cards and nobles from here

### 3. Test the Game

- Visit: `https://speldo-frontend.onrender.com`
- Create an account and start a game!

---

## Troubleshooting

### WebSocket Connection Issues

If players can't connect to games:

1. Verify `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
2. Check that Redis is running and connected
3. Check backend logs for WebSocket errors

### Database Connection Issues

1. Ensure `DATABASE_URL` is set correctly
2. Check that migrations have run (check build logs)
3. Verify the database is in the same region as backend

### Static Files Not Loading

1. Ensure `whitenoise` is in `INSTALLED_APPS`
2. Verify `collectstatic` ran during build
3. Check that `STATIC_ROOT` is configured

### CORS Errors

1. Verify `FRONTEND_URL` matches your frontend domain exactly
2. Check that `CORS_ALLOWED_ORIGINS` includes your frontend URL
3. For cookies, ensure `CORS_ALLOW_CREDENTIALS` is `True`

---

## Free Tier Limitations

Render's free tier has some limitations:

- **Spin-down**: Free services spin down after 15 minutes of inactivity. The first request will take ~30 seconds.
- **Limited resources**: Free tier has limited CPU and RAM
- **Database**: Free PostgreSQL databases expire after 90 days

For production use, consider upgrading to paid plans.

---

## Environment Variables Reference

### Backend

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | *(generate unique)* |
| `DEBUG` | Debug mode | `False` |
| `DATABASE_URL` | PostgreSQL connection | `postgres://user:pass@host/db` |
| `REDIS_URL` | Redis connection | `redis://host:6379` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://speldo-frontend.onrender.com` |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://speldo-backend.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `wss://speldo-backend.onrender.com` |

---

## Updating Your Deployment

When you push changes to your repository:

1. Render automatically detects changes
2. Builds and deploys the updated code
3. You can disable auto-deploy in service settings if needed

To manually trigger a deploy:
1. Go to your service on Render
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
