# CycleConnect Deployment Guide

This guide will help you deploy your cycling app to production using GitHub, Supabase, Vercel, and Render.

## Overview

**Architecture:**
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Vercel (React/Vite app)
- **Backend**: Render (Express.js server)
- **Code Repository**: GitHub

## Prerequisites

Before starting, create accounts at:
1. [GitHub](https://github.com) - Free
2. [Supabase](https://supabase.com) - Free tier available
3. [Vercel](https://vercel.com) - Free tier available  
4. [Render](https://render.com) - Free tier available

## Phase 1: Prepare Repository for GitHub

### Step 1: Create Production Environment Files

Create these files in your project root:

**`.env.example`** (template for others):
```env
# Database
DATABASE_URL=your_supabase_database_url_here

# Node Environment
NODE_ENV=production

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here
```

**`.gitignore`** (already exists, but verify it includes):
```
node_modules/
.env
.env.local
dist/
android/
uploads/
*.log
.DS_Store
```

### Step 2: Create Deployment Scripts

Add these scripts to handle different deployment scenarios.

## Phase 2: Database Setup (Supabase)

### Step 1: Create Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Fill in:
   - **Name**: `cycleconnect-db` (or your preference)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait 2-3 minutes for setup to complete

### Step 2: Get Database Connection String
1. In your Supabase project dashboard
2. Go to **Settings** → **Database**
3. Scroll down to **Connection string**
4. Select **Transaction pooler** 
5. Copy the URI (looks like: `postgresql://postgres.xxx:password@xxx.pooler.supabase.com:5432/postgres`)
6. Replace `[YOUR-PASSWORD]` with your actual database password

### Step 3: Configure Database Schema
Since your app uses Drizzle ORM, you'll push your schema to Supabase:

1. Update your `.env` with Supabase URL:
```env
DATABASE_URL=your_copied_supabase_url_here
```

2. Push your schema:
```bash
npm run db:push
```

## Phase 3: GitHub Repository Setup

### Step 1: Initialize Git Repository
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: CycleConnect cycling community app"
```

### Step 2: Create GitHub Repository
1. Go to [GitHub](https://github.com)
2. Click the "+" icon → "New repository"
3. Fill in:
   - **Repository name**: `cycleconnect`
   - **Description**: "Cycling community platform for group rides and activity tracking"
   - **Visibility**: Public or Private (your choice)
   - **Don't** initialize with README (you already have files)
4. Click "Create repository"

### Step 3: Connect Local Repository to GitHub
```bash
# Add GitHub as origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/cycleconnect.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Phase 4: Backend Deployment (Render)

### Step 1: Prepare Backend for Render
Render needs specific configuration files.

### Step 2: Deploy to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Choose "Build and deploy from a Git repository"
4. Connect your GitHub account
5. Select your `cycleconnect` repository
6. Configure the service:

**Basic Settings:**
- **Name**: `cycleconnect-api`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: Leave empty
- **Runtime**: `Node`

**Build & Deploy:**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Environment Variables** (click "Advanced"):
- `DATABASE_URL`: Your Supabase connection string
- `NODE_ENV`: `production`
- `SESSION_SECRET`: Generate a random 32+ character string
- `PORT`: `10000` (Render's default)

7. Click "Create Web Service"
8. Wait 5-10 minutes for first deployment
9. Note your backend URL (like: `https://cycleconnect-api.onrender.com`)

## Phase 5: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend for Vercel

### Step 2: Deploy to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:

**Project Settings:**
- **Project Name**: `cycleconnect`
- **Framework Preset**: `Vite`
- **Root Directory**: `./` (default)

**Build Settings:**
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`
- **Build Command**: `npm run build:frontend`

**Environment Variables:**
- `VITE_API_URL`: Your Render backend URL (like: `https://cycleconnect-api.onrender.com`)

5. Click "Deploy"
6. Wait 2-5 minutes for deployment
7. Note your frontend URL (like: `https://cycleconnect.vercel.app`)

## Phase 6: Configuration & Testing

### Step 1: Update CORS Settings
Your backend needs to allow requests from your Vercel domain.

### Step 2: Test Your Deployment
1. **Database**: Check Supabase dashboard for tables
2. **Backend**: Visit `https://your-render-url.onrender.com/health`
3. **Frontend**: Visit your Vercel URL and test features:
   - User registration/login
   - Creating rides
   - Uploading GPX files
   - Social features

### Step 3: Custom Domain (Optional)
If you want a custom domain like `cycleconnect.com`:

**For Vercel (Frontend):**
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain
3. Configure DNS records as shown

**For Render (Backend):**
1. Render Dashboard → Your Service → Settings → Custom Domains
2. Add your API subdomain (like `api.cycleconnect.com`)

## Phase 7: Ongoing Maintenance

### Updating Your App
When you make changes:

```bash
# Make your changes
git add .
git commit -m "Your change description"
git push origin main
```

- **Vercel** auto-deploys from GitHub pushes
- **Render** auto-deploys from GitHub pushes
- **Database changes**: Run `npm run db:push` locally, then push code

### Monitoring
- **Vercel**: Dashboard shows deployment status and analytics
- **Render**: Dashboard shows service health and logs
- **Supabase**: Dashboard shows database usage and performance

### Backup Strategy
- **Code**: Backed up on GitHub automatically
- **Database**: Supabase handles backups automatically
- **User uploads**: Consider adding cloud storage (AWS S3/Cloudinary)

## Troubleshooting Common Issues

**Build Fails on Vercel:**
- Check build logs in Vercel dashboard
- Ensure all dependencies in `package.json`
- Verify environment variables are set

**Backend Not Responding on Render:**
- Check service logs in Render dashboard
- Verify `DATABASE_URL` is correct
- Ensure `PORT` environment variable is set

**Database Connection Issues:**
- Double-check Supabase connection string
- Ensure password is correct in connection string
- Verify your IP isn't blocked (Supabase allows all by default)

**CORS Errors:**
- Update backend CORS to include your Vercel domain
- Check environment variables are properly set

## Security Checklist

Before going live:
- [ ] Strong database password set
- [ ] SESSION_SECRET is random and secure
- [ ] Environment variables properly configured
- [ ] No sensitive data in GitHub repository
- [ ] CORS properly configured
- [ ] SSL/HTTPS enabled (automatic on Vercel/Render)

Your CycleConnect app will be live and accessible worldwide once these steps are complete!