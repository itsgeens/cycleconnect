# Required Package.json Scripts for Deployment

Since you cannot directly edit package.json in this environment, you'll need to manually add these scripts when you set up your repository:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "build:frontend": "vite build",
    "build:backend": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push",
    "postinstall": "npm run build:backend"
  }
}
```

Add these scripts to your package.json before deploying.