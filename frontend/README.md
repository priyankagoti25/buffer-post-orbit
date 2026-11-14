# PostOrbit frontend

The web app for PostOrbit: overview, posts, composer with AI helper, recurring posts, ideas and settings. Built with React 19, TypeScript, Vite, Tailwind CSS 4 and Redux Toolkit.

## Requirements

- Node.js 20 or newer
- The PostOrbit backend running (see `../backend/README.md`)

## Setup

1. Install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Create your settings file:
   ```bash
   cp .env.example .env
   ```
   `VITE_API_URL` is where the backend runs. The default `http://localhost:4000` is right for local work.
3. Start the app:
   ```bash
   npm run dev
   ```
