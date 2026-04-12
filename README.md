# SpeechDetect

A desktop app for automatic speech-to-text transcription. Drop in an audio file — get back clean text. Export to PDF or DOCX, keep a full history of your transcriptions.

> Runs on Windows and macOS. Internet is only needed to call the Groq API — everything else is local.

---

## How it works

```
┌─────────────────────────────────┐
│         Electron (frontend)     │
│  renderer.js + styles.css       │
│  ↕ IPC (contextBridge)          │
│         preload.js              │
└──────────────┬──────────────────┘
               │ HTTP / REST
               ▼
┌─────────────────────────────────┐
│      FastAPI backend            │
│  server.py  ←→  database.py     │
│  transcriber.py                 │
│  SQLite (speechdetect.db)       │
└──────────────┬──────────────────┘
               │ HTTPS
               ▼
        Groq Whisper API
     (whisper-large-v3-turbo)
```

Electron spawns the FastAPI server as a child process (in production — a compiled binary via PyInstaller). The frontend talks to it over `localhost:8765`.

---

## Stack

| Layer | Technologies |
|---|---|
| Desktop shell | Electron 41 |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Transcription | [Groq API](https://console.groq.com) — Whisper large-v3-turbo |
| Audio processing | pydub + ffmpeg (imageio-ffmpeg) |
| Database | SQLite (stdlib) |
| Export | fpdf2 (PDF), python-docx (DOCX) |
| Backend packaging | PyInstaller |
| Installer | electron-builder |
| CI/CD | GitHub Actions |

---

## Quick start (dev mode)

### 1. Clone the repo

```bash
git clone https://github.com/Jekov-Evgen/Speech-detected.git
cd Speech-detected
```

### 2. Set up the backend

```bash
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r backend/requirements.txt
```

Create `backend/.env` with your Groq API key:

```
GROQ_API_KEY=your_key_here
```

Get a free key at https://console.groq.com/keys

### 3. Start the backend

```bash
cd backend
python server.py
# Server starts at http://127.0.0.1:8765
```

### 4. Install and launch Electron

```bash
cd frontend
npm install
npm start
```

---

## Building an installer

### Windows via GitHub Actions (recommended)

1. Add `GROQ_API_KEY` to your repo: **Settings → Secrets → Actions**.
2. Push a tag to trigger the pipeline:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. The finished `.exe` will appear under **Actions → Artifacts**.

### Local build (macOS / Windows)

```bash
# Build the backend binary
cd backend
pyinstaller server.spec --distpath dist --clean -y

# Build the Electron installer
cd ../frontend
npm install
npm run build:mac    # or build:win
```

Output lands in the `release/` folder.

> The API key is embedded into the bundle from the `GROQ_API_KEY` environment variable **at build time**.
> For a local build, export it first:
> ```bash
> export GROQ_API_KEY=your_key_here   # macOS/Linux
> set GROQ_API_KEY=your_key_here      # Windows CMD
> ```

---

## Supported audio formats

`.wav` · `.mp3` · `.ogg` · `.flac` · `.m4a`

Large files are automatically split into chunks ≤ 24 MB before being sent to Groq.

---

## REST API

The backend listens on `http://127.0.0.1:8765`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| POST | `/api/upload` | Upload an audio file |
| POST | `/api/transcribe/{id}` | Start transcription |
| GET | `/api/progress/{id}` | Transcription progress (0.0 – 1.0) |
| GET | `/api/history` | List all records |
| DELETE | `/api/history/{id}` | Delete a record and its file |
| GET | `/api/export/pdf/{id}` | Download transcript as PDF |
| GET | `/api/export/docx/{id}` | Download transcript as DOCX |

Interactive docs are available at `http://127.0.0.1:8765/docs` in dev mode.

---

## Repository structure

```
SpeechDetect/
├── backend/
│   ├── server.py          # FastAPI app, all endpoints
│   ├── transcriber.py     # Groq transcription logic
│   ├── database.py        # SQLite helpers
│   ├── server.spec        # PyInstaller config
│   ├── requirements.txt
│   └── fonts/             # DejaVu fonts for PDF export
├── frontend/
│   ├── main.js            # Electron main process
│   ├── preload.js         # contextBridge IPC
│   ├── renderer.js        # UI logic
│   ├── index.html
│   ├── styles.css
│   └── package.json
├── .github/
│   └── workflows/
│       └── build.yml      # CI: Windows installer build
└── .gitignore
```

---

## License

ISC