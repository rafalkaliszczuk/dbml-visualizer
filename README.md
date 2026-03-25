# DBML Visualizer

An interactive, browser-based entity-relationship diagram viewer for [DBML](https://dbml.dbdiagram.io/docs/) schemas. Upload a `.dbml` file, paste its contents, or embed it at build time — no backend required.

**[→ Live demo](https://rafalkaliszczuk.github.io/dbml-visualizer/)**

---

## Features

- Interactive ERD canvas with auto-layout (dagre LR)
- Left panel: searchable table list with field descriptions and notes rendered as Markdown
- Click a table → field detail view with types, constraints, default values
- Edges routed to exact source/target fields
- Highlighted relationships on table selection
- Dark theme only
- `localStorage` persistence — survives page refresh

---

## Usage options

### 1. Docker (recommended for local preview)

No Node.js required. Mount your DBML file and open the browser:

```bash
docker run -p 8080:80 \
  -v ./schema.dbml:/usr/share/nginx/html/schema.dbml:ro \
  rkali77/dbml-visualizer:latest
```

Then open **http://localhost:8080**.

Or with docker-compose (copy [`examples/docker-compose.yml`](examples/docker-compose.yml) next to your schema):

```bash
docker compose up
```

---

### 2. GitLab Pages (CI/CD in your repo)

Copy [`examples/gitlab-pages.yml`](examples/gitlab-pages.yml) to your repo as `.gitlab-ci.yml` and adjust the path to your DBML file:

```yaml
pages:
  image: node:20-alpine
  script:
    - apk add --no-cache git
    - git clone --depth=1 https://github.com/rafalkaliszczuk/dbml-visualizer.git /tmp/viz
    - npm --prefix /tmp/viz ci --prefer-offline
    - VITE_DBML_FILE="$CI_PROJECT_DIR/schema.dbml"
      VITE_BASE_PATH="/$CI_PROJECT_NAME/"
      npm --prefix /tmp/viz run build
    - cp -r /tmp/viz/dist public
  artifacts:
    paths: [public]
  only: [main]
```

The diagram will be published at `https://<namespace>.gitlab.io/<project-name>/`.

---

### 3. GitHub Actions Pages

See [`examples/`](examples/) for a ready-to-use GitHub Actions workflow.
The live demo for this repo is deployed this way via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

---

### 4. Manual build with your own schema

```bash
npm install
VITE_DBML_FILE=./schema.dbml npm run build
# Output in dist/ — deploy anywhere (Netlify, S3, nginx, ...)
```

---

### 5. Local development

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — use the upload/paste UI to load any DBML schema.

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `VITE_DBML_FILE` | *(none)* | Path to a `.dbml` file to embed at build time. When set, the app skips the upload UI and shows the diagram directly. |
| `VITE_BASE_PATH` | `/` | Base URL path. Set to `/<repo-name>/` for GitHub/GitLab Pages sub-path deployments. |

---

## DBML field notes

Field and table notes are rendered as Markdown in the detail panel:

```dbml
Table orders {
  id integer [pk, increment]
  user_id integer [not null, note: 'FK → users.id']
  total decimal(10,2) [not null, note: 'Order total in USD']
  status varchar [default: 'pending', note: 'pending | paid | shipped | cancelled']

  Note: '**Core transactional table.** One row per order.'
}
```

---

## Docker Hub setup (for contributors / forks)

The Docker image is built and pushed automatically on every push to `main` and on version tags (`v*.*.*`) via [`.github/workflows/docker.yml`](.github/workflows/docker.yml).

Add these secrets to your GitHub repo settings:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token (Account Settings → Security) |

--- 

## License

MIT
