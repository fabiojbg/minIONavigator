# Project Specifications: MinIO Navigator

This document describes the concept, architecture, and implementation details of **MinIO Navigator**, serving as a technical guide for developers and autonomous agents who maintain or extend this application.

---

## 1. General Concept

**MinIO Navigator** is a lightweight file browser and viewer for local MinIO servers (or other object storages compatible with the S3 API). 

The application is designed to provide quick and interactive viewing of project technical documentation (Markdown files with embedded Mermaid diagrams, JSON configuration files, log files, and various text files) without the need to download the files manually.

---

## 2. Directory Structure

The project follows a minimalist structure without complex SPA frameworks (such as React, Vue, or Angular), using pure HTML/CSS/JS and standard packages in the backend.

```
minIONavigator/
├── .dockerignore               # Docker ignore rules
├── .env.example                # Environment variables template
├── .env                        # Active connection keys to MinIO (Git ignored)
├── Dockerfile                  # Application container builder
├── docker-compose.yml          # Container orchestration (App + local MinIO)
├── package.json                # Dependency management
├── server.js                   # Application backend (Express + MinIO SDK)
├── specs/
│   └── 01-minIO Navigator.md   # This specification file
└── public/                     # Static frontend
    ├── index.html              # Main layout and CDN imports
    ├── style.css               # Dark theme and Markdown/Mermaid styling
    ├── app.js                  # Main entry point and orchestrator
    └── js/                     # Modular sub-components (ES Modules)
        ├── splitter.js         # Splitter/resize logic
        ├── treeview.js         # Sidebar folder navigation & actions
        ├── viewers.js          # File preview renderers (Markdown, Mermaid, CodeMirror)
        ├── modals.js           # Edit/delete/zoom overlays
        └── upload.js           # Sequential drag-and-drop uploader
```

---

## 3. Configuration (`.env`)

The application loads environment variables from the `.env` file. The essential variables are:

- `PORT`: Port used by the backend server (default: `4000`).
- `MINIO_ENDPOINT`: Host and port of the MinIO API panel (e.g., `localhost:9000`).
- `MINIO_USE_SSL`: Defines whether the connection uses HTTPS (`true` or `false`).
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`: Access credentials configured in MinIO.
- `MINIO_BUCKET`: Optional. Name of the default bucket to display as the root of the tree. If omitted, the application will start by showing a list of all visible buckets in the account.

---

## 4. Backend Architecture (`server.js`)

The backend is built in Node.js with the **Express** framework and uses the official `minio` library to communicate with the object storage server.

### API Endpoints

#### 1. List Objects: `GET /api/files`
- **Query Parameters**:
  - `bucket` (optional): The bucket to search in. If not provided and `MINIO_BUCKET` in `.env` is empty, returns a list of all available buckets.
  - `prefix` (optional): The virtual directory to list (e.g., `Docs/`).
- **Business Rules**:
  - Performs a non-recursive listing (`recursive: false`) under the specified prefix.
  - Formats output identifying virtual directories (prefixes) and regular files (objects).
  - **Sorting**: Separates folders and files. Sorts folders alphabetically and files alphabetically. Then, concatenates and returns the list with folders appearing first.
  
#### 2. Get Raw File: `GET /api/file`
- **Query Parameters**:
  - `bucket` (required)
  - `path` (required): The complete path to the desired object.
- **Business Rules**:
  - Retrieves the object stream using `getObject(bucket, path)`.
  - Resolves the file extension and assigns the appropriate `Content-Type` header (e.g., `text/markdown`, `application/json`, `text/plain`).
  - Pipes the stream directly to the request response (`stream.pipe(res)`).

#### 3. Delete Object/Folder: `DELETE /api/file`
- **Query Parameters**:
  - `bucket` (required)
  - `path` (required): The path or virtual prefix of the folder.
  - `isDir` (required): `true` for virtual directories (folders), `false` for simple files.
- **Business Rules**:
  - If `isDir` is `false`, triggers `removeObject` directly.
  - If `isDir` is `true`, performs a recursive listing of all keys under the prefix and executes a bulk `removeObjects` call in MinIO for recursive cleanup of subdirectories.

#### 4. Save Text File: `POST /api/save`
- **Request Body (JSON)**:
  - `bucket` (required)
  - `path` (required): The path of the object.
  - `content` (required): The updated text content.
- **Business Rules**:
  - Converts the received content string into a UTF-8 buffer.
  - Saves the file in MinIO using the `putObject` method, replacing the previous file.

#### 5. Upload File: `POST /api/upload`
- **Request Body (Multipart Form-Data)**:
  - `file`: The file data stream to upload.
  - `bucket` (required): The destination bucket name.
  - `path` (required): The full destination path (including virtual folders and filename).
- **Business Rules**:
  - Receives standard file uploads and parses them using the `multer` middleware in memory.
  - Saves the parsed file buffer directly to MinIO using `putObject`, preserving folder prefixes and replacing existing files with the same name.

---

## 5. Frontend Architecture (`public/`)

The interface was designed with a focus on user experience (UX) and a premium look, using dark themes inspired by modern IDEs.

### 5.1 HTML (`index.html`)
The frontend uses libraries imported via CDN to avoid complex build steps:
- **Lucide Icons**: Minimalist vector icons in SVG format.
- **Marked.js**: Fast Markdown-to-HTML converter.
- **DOMPurify**: Security sanitizer that removes malicious scripts injected in Markdown.
- **Mermaid.js**: JavaScript engine for rendering text-based flowcharts and diagrams.
- **Panzoom**: Lightweight library for zooming and panning HTML/SVG elements.

### 5.2 Screen Splitter
Implemented in the `app.js` script by listening to browser mouse events:
- Dynamically updates the width of the `.sidebar` element as the mouse drags the splitter bar.
- Sets the global CSS variable `--sidebar-width` to keep the layout consistent.
- Has minimum and maximum width limits (`220px` to `600px`).

### 5.3 Treeview Browser
The navigation component operates lazily (**lazy loading**):
1. On initial load, fetches the root elements from the API (`/api/files`).
2. Constructs nested DOM elements under the `.tree-node-wrapper` class.
3. **Folder Expansion**:
   - Triggered via **double-click** on the folder or a **single-click** on the expansion arrow (`.node-arrow`).
   - If folder data is not yet loaded, displays a spinner and calls `/api/files?bucket=...&prefix=...` to inject child elements into the DOM.
   - Rotates the `.node-arrow` by adding the `.expanded` class (turning the side arrow into a down arrow).
4. **File Selection**:
   - A single-click on a file node highlights it visually (adds class `.active`) and triggers the `loadFile` function.

### 5.4 Extensible Viewer Architecture
The application uses an ES Module script format (`type="module"`), where `public/app.js` serves as the entry point and state orchestrator. The main class `MinIONavigator` coordinates the state and instantiates modular sub-components located in the `public/js/` folder:
- **Splitter** (`splitter.js`): sidebar resizing.
- **Treeview** (`treeview.js`): directory navigation hierarchy, node rendering, and tree refreshing.
- **ViewerManager** (`viewers.js`): file content preview renderers.
- **ModalManager** (`modals.js`): modal overlays (Mermaid zoom/pan, text file editor, delete confirmation).
- **UploadManager** (`upload.js`): file upload queue and sequential uploads.

File rendering uses an extensible registration pattern defined inside the `ViewerManager` class constructor as `this.viewers`:

```javascript
this.viewers = [
  {
    name: 'Markdown',
    test: (filename) => filename.endsWith('.md'),
    render: async (bucket, path, container) => this.renderMarkdown(bucket, path, container)
  },
  {
    name: 'Text/JSON',
    test: (filename) => { /* test for txt, json, logs */ },
    render: async (bucket, path, container) => this.renderTextOrJson(bucket, path, container)
  }
];
```

If no viewer returns `true` in the file name test, the system uses the default `fallbackViewer`. This allows new file extensions (e.g., `.pdf`, `.png`) to be cleanly mapped in the future simply by inserting new elements into the `viewers` array.

### 5.5 Mermaid Diagrams Integration
When a Markdown file is rendered:
1. The markdown text is parsed to HTML and sanitized.
2. The application scans the generated HTML looking for code blocks labeled as `language-mermaid`.
3. Replaces `<pre><code>` blocks with a `.mermaid-container` wrapper and saves the original mermaid code in the element's `data-diagram` attribute.
4. Initializes Mermaid and triggers asynchronous rendering (`mermaid.render`), converting diagram text into an SVG injected into the viewport.
5. Adds a click listener to the SVG. When clicked, the application opens the interactive modal panel.
6. To prevent tall diagrams from stretching the Markdown document flow excessively, the inline `.mermaid-container` is capped at a maximum height of `500px` (`max-height: 400px`), and the SVG element is automatically scaled down proportionally to fit completely within this boundary (`max-height: 460px`). The user can click any diagram to open it in full resolution inside the interactive modal.

### 5.6 Interactive Modal (Zoom and Pan)
- The modal fills almost the entire viewport with a blurred translucent background (`backdrop-filter`).
- Receives the raw diagram code from the clicked element and reconstructs the SVG in the modal.
- Initializes the `Panzoom` library on the generated SVG, binding mouse wheel scrolling to zoom level controls and enabling free navigation by dragging the mouse.
- Offers quick manual controls: Zoom In, Zoom Out, Reset Zoom/Position, and Close.

### 5.7 Syntax Highlighting
Text and code file viewing utilizes modern syntax coloring engines:
- **Markdown Viewer (`.md`)**: Internal code blocks are analyzed post-processing and colored via the **Highlight.js** library (ignoring Mermaid diagram nodes).
- **Text/Code Viewer (`.txt`, `.json`, `.py`, etc.)**: Uses a **CodeMirror 5** editor instantiated in read-only mode (`readOnly: 'nocursor'`), supporting themes and line numbers. The mode is automatically selected based on the file extension.

### 5.8 File Management
The application allows modifying and removing files under secure rules:
- **Text Editing**: Takes place in a responsive modal that loads an editable CodeMirror instance. Allows changing the content and dynamically switching between 5 theme options (*Dracula*, *Monokai*, *Material Darker*, *Nord*, *Eclipse*), saving preferences in the user's `localStorage`. Upon saving, changes are persisted to the backend and the viewing panel is reloaded instantly.
- **Deletion**: Triggered via quick action buttons (`.node-actions`) that appear on hover over the sidebar tree (protecting main buckets). Displays a confirmation modal. Once successfully completed, surgically reloads only the affected parent directory of the tree, preserving the expanded state of other branches. If the deleted file was being viewed in the reading panel, the system clears the screen, redirecting to the welcome card.
- **File Uploads**: Allows uploading single or multiple files to the currently selected bucket and folder path. Supports standard file inputs (triggered from a cloud upload icon in the sidebar) and drag-and-drop actions globally over the window. Displays a full-screen drag-and-drop overlay with destination path indicators. Integrates a bottom-right floating Upload Manager with individual real-time progress bars. Uploads run sequentially, tracking progress and status. On completion, it surgically refreshes only the affected folder tree nodes.

---

## 6. Containerization (Docker)

To streamline testing, deployment, and development, the project includes Docker configuration.

### 6.1 Dockerfile
The application uses a single-stage `Dockerfile` based on `node:20-alpine`:
- Copies the `package.json` and `package-lock.json`.
- Runs `npm ci --omit=dev` to install only production dependencies.
- Copies the application source files (`server.js`, `public/`).
- Exposes port `4000` and configures the start command `npm start`.

### 6.2 Docker Compose (`docker-compose.yml`)
The orchestration file sets up a self-contained local environment containing two services:
1. **`minio`**: A local MinIO S3 API-compatible service running on port `9000` (API) and port `9001` (Console) with a persistent volume (`minio_data`).
2. **`app`**: The MinIO Navigator application container. It builds from the local directory and exposes port `4000` to the host.

### 6.3 Networking & Connections
- Within the Docker network, the application service resolves the hostname `minio` to the containerized MinIO instance.
- **Connection endpoint**: `MINIO_ENDPOINT` is configured to `minio:9000` inside the `docker-compose.yml`.
- If developers wish to connect the containerized app to a MinIO instance running on their host machine, they should configure `MINIO_ENDPOINT` to `host.docker.internal:9000` (on Windows/macOS).
