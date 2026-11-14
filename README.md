# PostOrbit

PostOrbit is a web app for crafting post text in reach text and allows you to create recurring post

- `backend/` is the API and the recurring-post worker. See [backend/README.md](backend/README.md).
- `frontend/` is the React app. See [frontend/README.md](frontend/README.md).

## What you can do

**Sign in with Buffer.** There is no separate password. "Continue with Buffer" uses OAuth 2.0 with PKCE. PostOrbit keeps your Buffer connection alive in the background, so you do not have to sign in again every hour.

**Overview.** Your Buffer account, organizations, channels, plan limits and post counts by status, on one page.

**Posts.** Browse every post by status (queue, drafts, overdue drafts, needs approval, sent), filter by organization and channel, and open any channel on its own page. You can edit a post, give a draft a time, delete a post, or repost an old one.

**Composer.**

- Rich text: bold, italic, underline, strikethrough, links, lists, @mentions and emoji.
- Photos and videos, uploaded through Cloudinary.
- One post to many channels at once, with the settings each network needs.
- When to post: add to queue, pick a date and time, share now, or save as a draft.
- Checks run before anything is sent: character limits, required media, number of files and dates in the past. This avoids failed calls to Buffer.

**AI writing helper.** A small chat next to the editor. It can write a post, improve or shorten your text, or suggest an idea. Nothing changes in your post until you press "Use in post". Replies are kept short and limited per person, to protect the free Gemini allowance.

**Recurring posts.** Repeat a post daily, weekly (chosen weekdays) or monthly, at a set time and time zone. Each channel has its own repeat. PostOrbit keeps the next two occurrences scheduled in Buffer and a background worker tops them up every minute. You can pause, resume, edit or cancel. Repeats must be at least two days apart, because Buffer refuses the same text on the same channel when posts are about a day apart.

**Ideas.** All your Buffer ideas and the ones saved in PostOrbit, in one list with search. Open one to read it, edit it (PostOrbit ideas only), or press **Make post** to turn it into a post. New ideas can also be saved to Buffer (text and still images). Buffer's API cannot edit or delete ideas, so those changes happen in Buffer.

**Sync with Buffer.** Every page that shows Buffer data has a Sync button. It pulls fresh data for that page. If a channel was removed in Buffer, PostOrbit deletes everything it held for that channel.

**Settings.** See the permissions you granted, reconnect or disconnect Buffer, and check the shared Buffer request limit.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Redux Toolkit, Tiptap editor
- **Backend:** Node.js, Express 5, TypeScript, MongoDB with Mongoose, Zod
- **Services:** Buffer (GraphQL), Cloudinary, Google Gemini
