# SafePath

SafePath is a location-aware mapping application designed to help users navigate safely by marking dangerous areas, creating safe routes, and providing real-time SOS functionality. The app works both online and offline, storing data locally when there's no internet connection and syncing when connectivity is restored.

## What It Does

SafePath lets you interact with a map in ways that matter for personal safety. You can drop markers to flag dangerous locations, create trails to navigate from point A to point B while avoiding hazards, and send SOS alerts when you're in trouble. Everything works offline, so you're not left stranded without connectivity.

The app tracks your location in real-time, shows your current position on the map, and calculates routes that take into account the markers you and others have placed. When you create a trail, the app considers whether you want the fastest route or the safest one, adjusting the path accordingly.

## Core Features

**Markers and Map Interaction**
- Drop markers anywhere on the map to mark locations as dangerous, safe, police stations, or general points of interest
- View all markers in your region, with custom icons for each type
- Tap markers to see details, including who placed them and when
- Delete markers you've created

**Trail Navigation**
- Create navigation trails from your current location to any marker
- Choose between fastest route or safest route (avoiding dangerous markers)
- Real-time distance and ETA calculations as you move
- Visual trail rendering on the map with turn-by-turn awareness
- Works offline using local routing when internet is unavailable

**SOS System**
- Send SOS alerts with your exact location
- Broadcasts appear to all nearby users in real-time
- View active SOS alerts from others on the map
- Respond to SOS alerts or cancel your own

**Offline Support**
- Native apps store all data locally using SQLite
- Native apps continue working without internet connection
- Automatic sync to Supabase when connectivity is restored
- Queue system for pending changes while offline (native only)
- Web version requires internet connection and uses Supabase directly

**Location Tracking**
- Real-time GPS tracking with accuracy indicators
- Background location updates (Android)
- Always-on location permission support
- Visual feedback showing your current position and movement

## Technical Architecture

### Platform Strategy

SafePath is built with React Native and Expo, using platform-specific files to optimize for web and native separately. Native builds use `react-native-maps` for mapping and SQLite for storage. Web builds use `react-leaflet` with Leaflet.js for maps and Supabase for cloud storage.

The file structure uses `.web.tsx` extensions for web-specific implementations, allowing the same import paths to resolve to different code depending on the platform. This keeps the codebase clean while letting each platform shine.

### Stack

**Frontend Framework**
- React Native 0.81.4 with React 19.1.0
- Expo SDK 54 with the new architecture enabled
- Expo Router for file-based routing
- TypeScript for type safety

**Native Platform**
- React Native Maps for mapping
- Expo SQLite for local database
- Expo Location for GPS tracking
- React Native Reanimated for animations

**Web Platform**
- React Leaflet 5.0 + Leaflet 1.9.4 for maps
- Supabase for cloud database
- React Native Web for component compatibility
- Custom web-optimized UI components

**Shared Libraries**
- Supabase client for real-time sync
- NetInfo for connectivity detection
- Geolib for distance calculations
- Mapbox Polyline for route encoding

### Architecture Patterns

**Context-Based State Management**
The app uses React Context for global state, with separate contexts for database operations, location tracking, SOS alerts, and trail navigation. This keeps concerns separated and makes the state easy to test and reason about.

**Platform-Specific Implementations**
Critical modules like `database.ts`, `map.tsx`, and sync logic have web-specific versions. The bundler automatically picks the right file based on the target platform, so developers work with clean imports while users get optimized code.

**Offline-First Design (Native Only)**
On native platforms, everything writes to SQLite first. Network requests happen asynchronously, and failures are handled gracefully. When you're offline, the app queues changes and applies them when connectivity returns. This makes the native app feel fast and reliable regardless of network conditions.

The web version skips local storage and communicates directly with Supabase. It requires an internet connection to function but benefits from simpler architecture and real-time updates without sync conflicts.

**Modular Map Components**
The map interface is split into logical modules: overlays for status indicators, modals for user interactions, markers for map pins, and trail components for navigation. This keeps the main map component lean and makes features easier to maintain.

### Data Flow

**Native Apps**
User interactions trigger actions in Context providers. These providers update local state immediately and write to SQLite. The sync system watches for changes and pushes them to Supabase when online. Incoming changes from other users are pulled via polling and merged into local state.

**Web App**
User interactions go directly to Supabase through the Context providers. No local database layer exists on web. The device ID is stored in localStorage, but all marker and SOS data lives in the cloud. This means web users always see real-time data but need connectivity to use the app.

Location updates flow from the GPS through the Location Context, which broadcasts position changes to all interested components. The trail system subscribes to location updates and recalculates distance/ETA in real-time.

SOS alerts go directly to Supabase and are broadcast to nearby users via real-time subscriptions. The SOS context manages active alerts and handles the UI notifications.

## Project Structure

```
/app                    # Expo Router pages
/components             # React components
  /Alert                # Custom alert system
  /map                  # Map-related components (modals, overlays)
  /markers              # Marker icons and modals
  /sos                  # SOS button and notifications
  /trail                # Trail bottom bar and controls
/contexts               # Global state management
/hooks                  # Custom React hooks
/types                  # TypeScript type definitions
/utils                  # Helper functions and business logic
/config                 # Configuration files (region settings)
```

Platform-specific files sit next to their native counterparts with `.web.tsx` or `.web.ts` extensions. The build system automatically picks the right version.

## Getting Started

### Development Setup

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npx expo start
```

This gives you options to run on:
- Android emulator or device
- iOS simulator or device (macOS only)
- Web browser

For platform-specific development:
```bash
npm run android    # Android only
npm run ios        # iOS only
npm run web        # Web only
```

### Environment Configuration

Create a `.env` file in the root directory:
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You'll need a Supabase project for cloud sync. The app works offline without it, but multi-user features require database access.

### Building for Production

**Web Deployment**
The web app is configured for Vercel deployment:
```bash
npx vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

**Android APK**
Build with EAS:
```bash
eas build --platform android --profile production
```

The build happens in the cloud and gives you a downloadable APK when complete.

### Database Setup

The app automatically creates the SQLite schema on native platforms. For web, you need to set up Supabase tables. Check the database utility files for the schema structure.

Tables needed:
- `markers` - User-placed map markers
- `sos_requests` - Active SOS alerts
- `trails` - Navigation route data

Enable Row Level Security policies to protect user data.

## Development Notes

The codebase uses the React Compiler for automatic optimization. It's enabled in the Expo config and doesn't require manual memoization in most cases.

File-based routing means adding a new page is as simple as creating a file in the `/app` directory. The router handles navigation automatically.

Custom hooks in `/hooks` handle complex stateful logic like network detection and map modal management. Use these rather than duplicating logic in components.

The alert system is custom-built because native web alerts look terrible. It uses React portals to render at the document root, ensuring proper z-index behavior.

## License

This project is private and not currently open source.
