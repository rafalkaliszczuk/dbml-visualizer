# DBML Visualizer

An interactive, browser-based entity-relationship diagram viewer for [DBML](https://dbml.dbdiagram.io/docs/) schemas. Upload a `.dbml` file, paste its contents, or embed it at build time — no backend required.

**[→ Live demo](https://rafalkaliszczuk.github.io/dbml-visualizer/)**

---

## Features

- Interactive ERD canvas with auto-layout
- Searchable table list with field descriptions rendered as Markdown
- Click a table to inspect fields, types, constraints, and default values
- Edges routed to exact source and target fields
- Highlighted relationships on table selection
- `localStorage` persistence — diagram survives page refresh
- Dark theme

---

## Usage

### Docker

The quickest way to visualize a local schema — no Node.js required:

```bash
docker run -p 8080:80 \
  -v ./schema.dbml:/usr/share/nginx/html/schema.dbml:ro \
  rkali77/dbml-visualizer:latest
```

Open **http://localhost:8080**. The diagram loads automatically from the mounted file.

Or with docker-compose (copy [`examples/docker-compose.yml`](examples/docker-compose.yml) next to your schema):

```bash
docker compose up
```

---

### GitLab Pages

Copy [`examples/gitlab-pages.yml`](examples/gitlab-pages.yml) to your repo as `.gitlab-ci.yml`:

```yaml
pages:
  image: node:20-alpine
  script:
    - apk add --no-cache git
    - git clone --depth=1 https://github.com/rafalkaliszczuk/dbml-visualizer.git /tmp/viz
    - npm --prefix /tmp/viz ci --prefer-offline
    - export VITE_DBML_FILE="$CI_PROJECT_DIR/schema.dbml" VITE_BASE_PATH="/$CI_PROJECT_NAME/"
    - npm --prefix /tmp/viz run build
    - cp -r /tmp/viz/dist public
  artifacts:
    paths: [public]
  only: [main]
```

The diagram will be published at `https://<namespace>.gitlab.io/<project-name>/`.

---

### GitHub Actions Pages

See [`.github/workflows/pages.yml`](.github/workflows/pages.yml) for the workflow used to deploy the live demo.

---

### Manual build

```bash
npm install
VITE_DBML_FILE=./schema.dbml npm run build
# Output in dist/ — deploy anywhere (Netlify, S3, nginx, ...)
```

---

### Local development

```bash
npm install
npm run dev
```

Open **http://localhost:5173** and use the upload or paste UI to load any DBML schema.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `VITE_DBML_FILE` | *(none)* | Path to a `.dbml` file to embed at build time. When set, the app skips the upload UI and renders the diagram directly. |
| `VITE_BASE_PATH` | `/` | Base URL path. Set to `/<repo-name>/` for GitHub/GitLab Pages sub-path deployments. |

---

## DBML notes

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

Full DBML reference: https://dbml.dbdiagram.io/docs/

---

## License

MIT
