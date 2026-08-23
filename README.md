# Peblo TV Mini 📺

> **Take-Home Challenge — Full-Stack Platform Engineer**  
> A miniature end-to-end streaming platform consisting of a React CMS, a Python/FastAPI backend, an atomic publishing pipeline, and a React-based Netflix-style Viewer UI.

---

## 🚀 1. Quick Start: How to Run the Project

The system is designed to be brought up quickly using Docker Compose. The compose file provisions the PostgreSQL database, runs migrations, seeds the data, and boots the backend API.

### Prerequisites
- Docker & Docker Compose (`docker compose`)
- Node.js 18+ & npm

### Step 1: Start the Backend Pipeline
```bash
# This brings up the Postgres DB and the FastAPI backend, and runs the seed script automatically.
docker compose up -d --build
```
- **API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

*Note: The database seeds automatically with two default users:*
- **Admin**: `admin@peblo.tv` / `admin123` (Full CMS CRUD + Publish rights)
- **Editor**: `editor@peblo.tv` / `editor123` (CMS CRUD only)

### Step 2: Start the CMS Frontend
```bash
cd cms
npm ci
npm run dev
```
- **CMS URL:** [http://localhost:5173](http://localhost:5173)

### Step 3: Start the Viewer UI
```bash
cd viewer
npm ci
npm run dev
```
- **Viewer URL:** [http://localhost:5174](http://localhost:5174)

---

## 🏛 2. Part E: Architectural Decisions & Written Responses

### How publishing is made atomic (and handling mid-publish failures)
To ensure viewers never read a half-written catalogue, the publishing job writes the generated JSON to a unique temporary file on disk (e.g., `catalogue.tmp.<uuid>.json`). Once the entire write operation completes and is flushed to the OS, we perform an atomic filesystem operation (`os.replace` in Python) to swap the temporary file over the live `catalogue.json`.
**If the process dies mid-publish:** The temporary file is simply abandoned. The live `catalogue.json` remains completely untouched, meaning viewers experience zero downtime or corrupted data. 

### Storage Abstraction (Moving to Cloudflare R2)
I implemented a `StorageBackend` abstract base class to decouple file I/O operations from the business logic. Currently, it uses a `LocalStorageBackend`. 
To migrate to Cloudflare R2 (which provides an S3-compatible API), the only necessary change is creating an `S3StorageBackend` class that implements `save_file(path, bytes)` and `get_file(path)` using the `boto3` library. The system can then inject this new class at runtime when a `STORAGE_BACKEND=s3` environment variable is detected. No route handlers or publish jobs would need to change.

### Search Implementation & Scale Limits
**Implementation:** Search is implemented in the FastAPI backend by loading the active `catalogue.json` snapshot into memory and applying Python-based filtering across `title`, `category`, `language`, and `section`. 
**Limitations:** This works flawlessly for small-to-medium catalogues (e.g., ~1,000 titles) because JSON parsing and list comprehensions in Python are fast. However, at around **10,000 to 50,000+ titles**, parsing large JSON payloads into memory per request will cause high latency, memory bloat, and thread blocking.
**Next Steps:** For a larger catalogue, I would shift search back to the database layer utilizing PostgreSQL's Full-Text Search with `pg_trgm` (trigram) indexes, or offload it entirely to a dedicated search engine like Typesense or Elasticsearch with edge CDN caching.

### Pre-published Catalogue vs. Database Queries Per Request
**Why pre-publish?** The Viewer UI traffic pattern is heavily read-oriented and can experience massive spikes (e.g., a new show drops). Serving a static `catalogue.json` drastically reduces database load. A static file can be served via a CDN (like Cloudflare) directly from the edge, achieving near-infinite scalability and sub-10ms response times without touching our PostgreSQL database.
**Where it bites us:** It creates an eventual consistency hurdle. Editors must explicitly remember to hit "Publish", and there is a natural delay between saving a change in the CMS and a user seeing it on their TV. 

### Stretch Goals Implemented
I have successfully implemented both optional stretch goals to make the platform highly robust:
1. **Versioned Catalogue & Rollbacks:** The system retains historical copies of `catalogue_{run_id}.json`. The CMS Dashboard provides a "Publish History" view, allowing Admins to instantaneously roll back the Viewer UI to any previous publish state via an atomic `os.replace` operation.
2. **Audit Logs:** All mutating actions (Creates, Updates, Deletes, Uploads, Publishes, and Rollbacks) are logged to a dedicated `AuditLog` table using a `log_audit_event` backend helper. This is queryable via a real-time Audit Logs dashboard in the CMS.

### AI Usage & Development Strategy
I used Antigravity for coding, architecture planning, and feature execution. While the core foundation was built rapidly, I took a highly iterative approach for the CMS and Viewer UI to ensure premium, Netflix-like usability. Furthermore, I employed a careful verification strategy when implementing the atomic rollback mechanism to ensure 100% zero-downtime file swaps without losing historical data backups on disk. Inline edit capabilities and dynamic duration parsing were added to the frontend post-launch to maximize operator efficiency.

---

## 🕵️ 3. Handling the "Imperfect" Seed Data

The challenge noted that the seed data was deliberately imperfect. Here is how I handled the traps:

1. **Missing Artwork & Sections:** Some shows (like *Rhyme Rangers*) lacked sections or artwork. The backend exposes a `GET /admin/validation-report` endpoint. The CMS Publish page hits this and disables the Publish button if blocking issues exist, showing the editor exactly what is missing in human-readable terms.
2. **Duplicate Language Groups:** `ep_9001` duplicated a Hindi variant of another episode. I enforced a `UNIQUE(content_group, language)` constraint in Postgres; the seed script catches this IntegrityError and skips duplicates gracefully.
3. **Season 0 (Trailers):** The publish job actively filters out `season_number == 0` when generating the catalogue JSON, ensuring the Viewer UI never renders it as a standard playable season.

---

## 🔒 4. Pipeline & Operability

- **CI/CD Pipeline:** I included a `.github/workflows/ci.yml` file. On every push, this spins up an Ubuntu runner, lints the Python code, verifies dependencies, and executes test builds of the React apps. This ensures the main branch remains deployable.
- **Secrets Management:** The `.env.example` file contains all necessary environment variables. In a production environment, secrets (like `JWT_SECRET_KEY` and DB passwords) should **never** be checked into version control. They should be managed via AWS Secrets Manager or HashiCorp Vault, and injected into the ECS/Kubernetes containers dynamically at runtime.
- **Alerting & Health:** The API exposes a `/health` endpoint. In production, I would alert on **Publish Job Failures**. If the atomic publish job fails continuously, editors are flying blind and users aren't receiving new content, which is a critical business failure.

---

## ⏱ 5. Time Spent

- **Backend Scaffolding & Models:** 1 hour
- **Storage Abstraction & Image Validation:** 45 minutes
- **Auth & Role-Based Access:** 30 minutes
- **Atomic Publish Job:** 1 hour
- **CMS Frontend:** 1 hour
- **Viewer UI (Netflix Style):** 30 minutes
- **Stretch Goals (Rollback & Audit Logs):** 1 hour
- **CI/CD & Documentation:** 30 minutes
