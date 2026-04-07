# MediSphere

AI-powered health companion to help users upload reports, organize medical files, and get prescription/lab insights with reminder support.

## Live Demo
- Web App: https://medispher.netlify.app/login

## Best Experience
- Open on a mobile device for the best experience (UI and workflows are optimized for phone usage).

## Problem Statement
Personal Health Record & Pre-Consultation Summary tool

## Our Solution
MediSphere provides one place to:
- Upload and store prescriptions/lab files securely
- Analyze reports for quick health insights
- View records in a categorized medical locker
- Set and manage medicine reminders

## Key Features
- Authentication and profile onboarding
- Prescription and lab report upload flow
- Automated analysis pipeline integration
- MediLocker file organization and preview
- Reminder creation, edit, and delete support
- Mobile-friendly interface

## Tech Stack
- Frontend: Expo, React Native, Expo Router, TypeScript
- Backend/Services: Firebase (Auth/Firestore), Supabase Functions, Cloudinary
- Deployment: Netlify (web), EAS (mobile builds)

## Run Locally
```bash
npm install
npm run dev
```

Useful commands:
```bash
npm run typecheck
npm run lint
npm run build:web
```

## Project Structure
- `app/` - Expo Router screens (`(auth)` and `(tabs)`)
- `utils/` - Firebase/data helpers and app utilities
- `components/integrations/supabase/` - Supabase client/types
- `supabase/functions/scan-prescription/` - Edge function logic
- `ScanPrescription/` - Python analyzer service code

## Hackathon Notes
- Built for rapid, practical healthcare workflow support.
- Prioritizes simple UX for daily usage and quick decision support.
