---
trigger: always_on
---

**MinIO Navigator** is a lightweight file browser and viewer for local MinIO servers (or other object storages compatible with the S3 API). 

The application is designed to provide quick and interactive viewing of project technical documentation (Markdown files with embedded Mermaid diagrams, JSON configuration files, log files, and various text files) without the need to download the files manually.

## 1. Project Specifications
The specifications are located in the `specs/` folder. The numeric prefix, such as `01-` for example, indicates the order in which the specifications were created.

* **specs/01-minIO-navigator.md**: The main specifications of this project.
* **specs/02-manager.md**: A windows dektop app to start and stop the app service.
* **README.md**: read this file to understand and know how to use the project

These specifications must be updated whenever any change requires them to be updated.

## 2. Tech Stack
The application is built using the following technologies:
* **Backend**:
  * **Node.js** with **Express** (web framework)
  * **MinIO Client SDK** (`minio`) for S3 API compatibility
  * **Multer** for multipart file uploads
  * **Dotenv** for configuration via environment variables
* **Frontend**:
  * **Vanilla HTML, CSS, JavaScript (ES Modules)**
  * **Marked.js** & **DOMPurify** (safe Markdown parsing and rendering)
  * **Highlight.js** (code block syntax highlighting)
  * **CodeMirror 5** (interactive file editing with switchable themes)
  * **Mermaid.js** & **Panzoom** (interactive fullscreen diagram visualization)
  * **Lucide Icons** (clean UI icons)

## 3. Project Structure
The folder structure and key files are organized as follows:
```
minIONavigator/
├── .agents/
│   └── rules/
│       └── 01-project-instructions.md  <-- Instructions, tech stack, and structure rules for AI agents.
├── specs/
│   └── 01-minIO-navigator.md           <-- Project functional specifications.
├── public/                             <-- Static frontend application assets.
│   ├── index.html                      <-- Main page layout and external assets imports.
│   ├── style.css                       <-- Main styles, color theme variables, and layout.
│   ├── app.js                          <-- Main frontend controller and ES module coordinator.
│   └── js/                             <-- Modular JavaScript features.
│       ├── treeview.js                 <-- Interactive sidebar navigation, directory structures, and lazy-loading.
│       ├── splitter.js                 <-- Drag-and-drop vertical divider/splitter logic.
│       ├── viewers.js                  <-- Markdown, CodeMirror viewer, and raw download logic.
│       ├── modals.js                   <-- Modals for file editing, mermaid pan & zoom, and deletion confirms.
│       └── upload.js                   <-- Drag-and-drop file upload manager with sequential queues and progress panels.
├── server.js                           <-- Node.js Express server entrypoint (MinIO interactions, uploads, deletions).
├── Dockerfile                          <-- Docker image setup.
├── docker-compose.yml                  <-- Orchestration for local development stacks (MinIO Navigator + MinIO Server).
├── package.json                        <-- Node.js manifest with scripts and library dependencies.
├── README.md                           <-- Overview, setup instructions, and screenshots.
└── .env.example                        <-- Reference file for configuring environment variables.
```

## 4. Design and Documentation
* Update the `README.md` file whenever necessary.