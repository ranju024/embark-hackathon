# Hackathon Starter — Django + React

Ready-to-run scaffold: Django/DRF backend (JWT auth, Postgres, CORS) + React (Vite) frontend
already wired to talk to it. Rename `Item` to whatever your real idea needs and copy the pattern.

## 1. One-time setup (do this BEFORE the hackathon starts)

### Backend

```bash
cd backend
python -m venv venv
# Windows (cmd or PowerShell):
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env            # edit values if needed
```

Make sure Postgres is running locally and a database matching `DB_NAME` in `.env` exists:

```bash
createdb hackathon_db
```

Then:

```bash
python manage.py migrate
python manage.py createsuperuser   # for /admin/ access
python manage.py runserver
```

Backend now runs at `http://localhost:8000`. Test it: open `http://localhost:8000/api/health/`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at `http://localhost:5173`. Open it — it should show "backend is alive".

## 2. When the challenge starts

1. Rename the `Item` model in `backend/api/models.py` to your real entity (or add more models next to it).
2. Run `python manage.py makemigrations && python manage.py migrate` after any model change.
3. Copy the `ItemViewSet` + serializer pattern for each new model.
4. On the frontend, copy the `api.js` functions for each new endpoint.

## 3. GitHub repo & branching workflow (for the team)

**Repo owner (whoever creates it) does this first:**

```bash
# from inside this folder
git init
git add .
git commit -m "Initial hackathon boilerplate"
gh repo create your-team-hackathon-project --private --source=. --push
# no gh CLI? Create the repo on github.com first, then:
# git remote add origin https://github.com/<you>/<repo>.git
# git branch -M main
# git push -u origin main
```

**Everyone else joins:**

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
```

**Branch naming convention** — one branch per person/feature, off `main`:

```bash
git checkout -b feature/<yourname>-<what>
# e.g. feature/ranju-auth, feature/sita-frontend-ui, feature/hari-items-api
```

**While working:**

```bash
git add .
git commit -m "short clear message"
git push -u origin feature/<yourname>-<what>
```

**Merging back into main** (fastest safe way for a hackathon — skip formal PR review if you're
under 4 people and trust each other, but still use PRs to avoid stepping on each other's changes):

```bash
# on GitHub: open a Pull Request from your branch into main, then merge it
# OR locally if you're comfortable:
git checkout main
git pull origin main
git merge feature/<yourname>-<what>
git push origin main
```

**Rules that save time later:**

- Pull `main` before you start a new session: `git checkout main && git pull`
- Commit small and often — easier to undo one bad commit than one giant one
- Never commit `.env` files (already in `.gitignore`) — everyone keeps their own local copy
- If two people touch `models.py` at once, coordinate migrations — merge conflicts in migration
  files are the #1 time-waster in hackathon Django projects

## 4. AI chatbot (free, no credit card)

Already wired end-to-end: React chat box -> `POST /api/chat/` -> NVIDIA NIM's free API.

1. Go to https://build.nvidia.com, sign in (no card required), grab an API key
2. Put it in `backend/.env` as `NVIDIA_API_KEY=...`
3. Restart the Django server — the chat box on the frontend now works

**If NVIDIA's free credits run out mid-event**, switch providers by editing only the top of
`backend/api/views.py` (the `_ai_client` and `AI_MODEL` lines) — the rest of the `chat` view,
the URL, and the frontend don't need to change:

- **Google Gemini** (most generous permanent free tier, no card): get a key at
  https://aistudio.google.com/apikey, then use
  `base_url="https://generativelanguage.googleapis.com/v1beta/openai/"` and
  `api_key=os.getenv("GEMINI_API_KEY")`, model e.g. `"gemini-2.5-flash"`
- **Groq** (very fast, free, no card): `base_url="https://api.groq.com/openai/v1"`,
  model e.g. `"llama-3.3-70b-versatile"`

## 5. Optional: switching to Supabase mid-event

If you decide you want Supabase's hosted Postgres/auth instead of your own Django auth:

- Get the connection details from Supabase → Project Settings → Database
- Drop them into `backend/.env` (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`)
- Use `supabase/rls_policy_templates.sql` for row-level security once tables exist
- You can still use Django/DRF as your API layer on top of Supabase's Postgres — you don't have
  to use Supabase's auto-generated API if your own endpoints already work
