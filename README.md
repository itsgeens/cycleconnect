# CycleConnect 🚴‍♂️

Initial build on Replit. A comprehensive cycling community platform that connects riders, organizes group rides, and tracks performance with smart device integration.

## Features

### 🌟 Core Features
- **Group Ride Organization** - Create and join group rides with detailed route planning
- **GPX Route Support** - Upload and visualize cycling routes with elevation profiles
- **Social Networking** - Follow other cyclists, discover new riding partners
- **Performance Tracking** - Comprehensive activity analytics and personal statistics
- **Smart Device Integration** - Connect cycling computers and smartwatches via Bluetooth LE

### 📱 Advanced Features
- **Automatic Ride Completion** - Smart matching of device activities to planned rides
- **Weather Integration** - Cycling-specific weather assessments for ride planning
- **Activity Data Analysis** - Heart rate, speed, elevation, and time tracking
- **Mobile Support** - Android APK for testing bluetooth device connections
- **Real-time Updates** - Live data streaming from connected devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** + **shadcn/ui** for styling
- **TanStack Query** for state management
- **Wouter** for client-side routing

### Backend
- **Node.js** + **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Multer** for GPX file uploads
- **bcrypt** for secure authentication

### Database & Deployment
- **PostgreSQL** (Supabase for production)
- **Vercel** for frontend hosting
- **Render** for backend API hosting
- **Capacitor** for Android APK packaging

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (local or Supabase)

### Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/cycleconnect.git
cd cycleconnect

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Push database schema
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:5000` to see the app.

### Android APK Build
```bash
# Build for Android
./build-android.sh

# Open Android Studio
npx cap open android
```

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for comprehensive deployment instructions covering:
- Database setup with Supabase
- Backend deployment to Render
- Frontend deployment to Vercel
- Environment configuration
- Production optimization

## Project Structure

```
cycleconnect/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── lib/            # Utilities and configurations
│   │   └── hooks/          # Custom React hooks
├── server/                 # Express backend
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database operations
│   └── index.ts            # Server entry point
├── shared/                 # Shared TypeScript schemas
├── android/                # Capacitor Android project
├── uploads/                # GPX file storage
└── dist/                   # Production builds
```

## Key Features Explained

### Smart Device Integration
- Connect Garmin, Wahoo, and other Bluetooth LE devices
- Real-time data streaming during rides
- Automatic activity matching with 85% similarity threshold
- Support for heart rate, speed, cadence, and power data

### Route Matching Algorithm
- Geometric similarity using Hausdorff distance
- Temporal alignment with Dynamic Time Warping
- Elevation correlation analysis
- GPS coordinate tolerance with geographic bonus scoring

### Performance Analytics
- Active vs total time distinction
- Moving average calculations excluding stops
- Heart rate zone analysis
- Elevation gain/loss tracking
- Speed and distance metrics

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For deployment help, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
For Android builds, see [ANDROID_BUILD.md](./ANDROID_BUILD.md)

Built with ❤️ for the cycling community.
# cycleconnect-staging
# cycleconnect-staging
