# MinIO Navigator

**MinIO Navigator** is a lightweight, modern application developed in Node.js to assist in directory navigation and file viewing on a local MinIO server (or any other service compatible with the S3 API). 

It offers a premium, responsive web interface with a dark theme (Dark Theme), focused on readability and interactivity of technical documents, containing native support for Markdown and interactive Mermaid diagram rendering.

> This project is only a simple developer tool, quickly created using Google's Antigravity and Gemini 3.5 Flash (Damn! This model is really fast and smart!) to help me navigate, view, and even edit files directly in MinIO buckets because its console interface is awful. Enjoy!
---

## Key Features

- **Dynamic Sidebar Treeview (Lazy-Loaded)**: Loads folders on demand as the user navigates. Folders are displayed before files, and everything is sorted alphabetically. **State Preservation**: The tree automatically remembers and restores your expanded folders and active selection when you refresh the view.
- **Flexible Splitter**: Allows adjusting the width of the navigation sidebar by dragging the border with the mouse.
- **Extensible File Viewer**:
  - **Markdown (`.md`)**: Rendered in clean and secure HTML (via `marked` and `DOMPurify`), with syntax highlighting in code blocks via **Highlight.js**.
  - **Text / Code (`.txt`, `.json`, `.yml`, etc.)**: Premium viewer with line numbers and syntax highlighting via **CodeMirror 5** (read-only mode).
  - **Unsupported Files**: Informative message display with a direct download/view link for the raw content.
- **Secure File Management**:
  - **Edit in Popup**: Allows editing text/markdown files directly in a popup/modal using CodeMirror. Includes a dropdown supporting 5 color themes (*Dracula*, *Monokai*, *Material Darker*, *Nord*, *Eclipse*) persisted in `localStorage`.
  - **Deletion**: Allows permanently deleting files or folders recursively directly in the sidebar (with a confirmation modal to prevent accidents).
  - **Sequential File Uploads (Drag & Drop)**: Allows uploading single or multiple files by dragging them over the window or clicking the upload button. Displays a beautiful floating panel showing sequential progress bars, and surgically refreshes the modified directories in the treeview on completion.
- **Interactive Mermaid Diagrams**:
  - Renders ` ```mermaid ` code blocks directly as SVG in the document body.
  - Clicking on the diagram opens a **fullscreen popup** with advanced **Pan (drag)** and **Zoom (mouse wheel)** capabilities using the `Panzoom` library.

---

## Screenshots

Here are some visual examples of the application's main interface and features:

### 1. Markdown Viewer & Diagram Renderer
Allows viewing rich Markdown documentation with embedded, interactive Mermaid diagrams.
![Markdown Viewer](img/markdown-viewer.png)

### 2. Text & Code File Viewer
Displays code files (like JSON, YAML, etc.) with custom themes, syntax highlighting, and line numbers.
![JSON File Viewer](img/text-file-viewer.png)

### 3. Interactive File Editor
Allows modifying file contents directly through the web UI with a theme-switchable CodeMirror code editor modal.
![Text File Editor](img/text-file-edit.png)

---

## Requirements

- **Node.js** (version 16 or higher)
- A **MinIO** server running locally or remotely.

---

## Installation

1. Clone or extract the project files to your local directory.
2. Open the project folder in your terminal and install dependencies:
   ```bash
   npm install
   ```

---

## Configuration (`.env`)

Create a file named `.env` in the root of the project (use `.env.example` as a template). It must contain the following settings:

```env
# Port where the Node.js server will run
PORT=4000

# MinIO Connection Details
MINIO_ENDPOINT=localhost:9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key

# Default Bucket name you wish to explore
# (If left blank, the root will display the list of all available buckets)
MINIO_BUCKET=mdvis-docs
```

---

## Running the Project

To start the web server:

### In Production
```bash
npm start
```

### In Development (automatically restarts when changing files)
```bash
npm run dev
```

### For advanced users: With Docker Compose
To run MinIO Navigator alongside a local pre-configured MinIO server instance in docker containers:
```bash
docker compose up --build -d
```
After starting:
- **MinIO Navigator UI**: 👉 **[http://localhost:4000](http://localhost:4000)**

> [!ATTENTION] - HOW TO CONNECT THE MINIO FROM ANOTHER DOCKER COMPOSE STACK

> If you have MinIO running in another Docker Compose stack, follow the instructions on Dockerfile before run `docker compose up -d`

---



