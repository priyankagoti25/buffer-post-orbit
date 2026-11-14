# PostOrbit backend

The API for PostOrbit. It handles Buffer sign-in, calls Buffer's GraphQL API for the user, signs media uploads, talks to Gemini for the AI helper, and runs the recurring-post worker. Built with Node.js, Express 5, TypeScript and MongoDB.

## Requirements

- Node.js 20 or newer
- A MongoDB database (local, or a free MongoDB Atlas cluster)
- A Buffer API app (client id and secret)
- A Cloudinary account (for media uploads)
- Optional: a Google AI Studio key for the AI helper

## Setup

1. Install packages:
   ```bash
   cd backend
   npm install
   ```
2. Create your settings file and fill it in:
   ```bash
   cp .env.example .env
   npm run gen-key        # prints a value for TOKEN_ENCRYPTION_KEY
   ```
3. Register your app in Buffer (Settings, API). Set the redirect URI to `http://localhost:4000/api/buffer/callback`, exactly as it is in `.env`, and copy the client id and secret into `.env`. Enable the scopes you request.
4. Start the server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:4000/health`. It should answer `{"ok":true,...}`.
