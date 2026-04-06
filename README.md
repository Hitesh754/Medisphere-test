# Medisphere (Expo)

This is an Expo React Native app using Expo Router.

## 1) Prerequisites
Install these:
- **Node.js LTS** (recommended: Node 20+)
- **npm** (comes with Node.js)
- **Expo Go** app on phone (optional, for testing on real device)

## 2) Clone the project

```bash
git clone <your-repo-url>
cd "Expo Project"
```

## 3) Install dependencies

```bash
npm install
```

## 4) Run the app (development)

```bash
npm run dev
```

This starts Expo Dev Server and shows options in terminal:

- Press `a` → open Android emulator/device
- Press `i` → open iOS simulator (macOS only)
- Press `w` → open web
- Scan the QR code with Expo Go (Android) or Camera app (iOS)

## 5) Other useful commands

```bash
npm run lint
npm run typecheck
npm run build:web
```

## Common issues

- If install fails, delete `node_modules` and lockfile, then reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
  On Windows PowerShell:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  Remove-Item -Force package-lock.json
  npm install
  ```

- If Metro cache has issues:
  ```bash
  npx expo start -c
  ```

## Notes

- Project scripts are defined in `package.json`.
- Main entry is `expo-router/entry`.

## Active structure

The project is currently organized around these active modules:

- `app/` - Expo Router screens (`(auth)` and `(tabs)` groups)
- `components/integrations/supabase/` - Supabase client used by prescription analyzer
- `constants/` - app constants and mock data
- `utils/auth.ts` - auth token helper
- `ScanPrescription/api/` - Python analyzer backend API
- `supabase/functions/scan-prescription/` - Supabase edge function for prescription scan

Legacy/unneeded UI modules and meal-planner screens were removed to keep the codebase clean and focused.
