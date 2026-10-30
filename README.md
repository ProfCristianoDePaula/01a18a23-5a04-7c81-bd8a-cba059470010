# DocumentAI

React web app for turning WhatsApp chat exports into chronological Word documents with inline images and optional audio transcriptions. Capacitor packages the same React interface for Android.

## Run locally

```sh
pnpm install
pnpm dev
```

The web app expects the API on `http://127.0.0.1:8000`; Vite proxies `/api` during development. In another terminal, prepare and start it:

```powershell
python -m venv server/.venv
server/.venv/Scripts/python -m pip install -r server/requirements.txt
Copy-Item server/.env.example server/.env
server/.venv/Scripts/uvicorn main:app --reload --port 8000 --app-dir server
```

Set `OPENAI_API_KEY` in `server/.env` to enable optional Portuguese audio transcription. The API key stays on the server; it is never included in the web build or Android package. Users must activate the transcription option before audio is sent. Without transcription, the chat and available media are still rendered in chronological order.

The server stores accounts, sessions, job status, and final DOCX files in `server/data/`. It deletes each ZIP and processing folder when the job finishes, including after a failed job. For Android, copy `.env.example` to `.env`, set `VITE_API_URL` to the deployed API base URL, then build and sync. Add the app/web origins to `FIO_ALLOWED_ORIGINS`. Production requires HTTPS, `FIO_COOKIE_SECURE=true`, and `FIO_COOKIE_SAMESITE=none` when the app and API use different origins.

Create a production web build with `pnpm build`. Android project commands:

```sh
pnpm android:add
pnpm android:sync
pnpm android:open
```

Android builds require Android Studio and an Android SDK. The Capacitor project is already scaffolded in `android/`.

## Current state

- Responsive dashboard, ZIP selection/drop zone, optional transcription consent, data handling notice, account dialogs, document and plan views.
- Web and Android shell share one React codebase.
- FastAPI backend provides account registration/login/logout, session cookies, ZIP upload, background DOCX generation, status tracking, download, and deletion.
- DOCX output contains chronological messages, available inline images, and optional audio transcripts adjacent to the matching voice message. The generator notes that transcription can contain errors and does not certify the source material.
- The ZIP and source audio are intended to be deleted after DOCX generation. The resulting DOCX stays in the user's account until they delete it.
- Audio transcription is optional, requires an explicit opt-in, and discloses OpenAI as the transcription processor.

## Product decisions recorded

- Start with a user account, WhatsApp ZIP upload, chronological DOCX, and download.
- Keep the transcription step optional and require consent before any audio is processed by a third-party service.
- Remove source ZIP and audio files after successful DOCX generation.
- Keep pricing and plan limits undecided while the first workflow is built.

## Current limits

- This is an early MVP: the local database is SQLite, accounts do not yet have email verification or password recovery, and there is no subscription or payment system.
- Production deployment, HTTPS, backups, retention rules for final DOCX files, privacy terms, and Android signing/distribution still need configuration before public launch.
- For Android development/building, install Android Studio and an Android SDK. The Capacitor project is already scaffolded in `android/`.
