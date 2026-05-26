// Application State & Main Logic Class
class MinIONavigator {
  constructor() {
    // Application State
    this.currentBucket = '';
    this.isResizing = false;
    this.currentViewerEditor = null;
    this.editEditorInstance = null;
    this.activeFileMeta = null;
    this.panzoomInstance = null;
    this.nodeToDelete = null;
    this.currentFolder = '';
    this.uploadQueue = [];
    this.isUploading = false;

    // Extensible Viewer Registry
    this.viewers = [
      {
        name: 'Markdown',
        test: (filename) => filename.endsWith('.md'),
        render: async (bucket, path, container) => this.renderMarkdown(bucket, path, container)
      },
      {
        name: 'Text/JSON',
        test: (filename) => {
          const ext = filename.split('.').pop().toLowerCase();
          return ['txt', 'json', 'log', 'xml', 'js', 'py', 'html', 'css', 'yaml', 'yml', 'env', 'conf', 'ini'].includes(ext);
        },
        render: async (bucket, path, container) => this.renderTextOrJson(bucket, path, container)
      }
    ];

    this.fallbackViewer = {
      name: 'Default Fallback',
      render: async (bucket, path, container) => this.renderFallback(bucket, path, container)
    };
  }

  // Initial setup
  init() {
    this.initSplitter();
    this.initTreeview();
    this.initModal();
    this.initEditModal();
    this.initDeleteModal();
    this.initUploadManager();
    lucide.createIcons();
  }

  /* Splitter Logic */
  initSplitter() {
    const splitter = document.getElementById('splitter');
    const sidebar = document.getElementById('sidebar');

    splitter.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      splitter.classList.add('active');
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 220 && newWidth <= 600) {
        sidebar.style.width = `${newWidth}px`;
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        splitter.classList.remove('active');
        if (this.currentViewerEditor) {
          this.currentViewerEditor.refresh();
        }
      }
    });
  }

  /* Treeview Logic */
  async initTreeview() {
    const refreshBtn = document.getElementById('refresh-btn');

    refreshBtn.addEventListener('click', () => {
      this.loadRootNodes();
    });

    await this.loadRootNodes();
  }

  async loadRootNodes() {
    const treeContainer = document.getElementById('tree-container');
    const bucketNameSpan = document.getElementById('current-bucket-name');
    
    treeContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Fetching root...</span>
      </div>
    `;

    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error(`Status: ${res.statusText}`);
      const items = await res.json();
      
      treeContainer.innerHTML = '';
      this.currentFolder = '';
      
      if (items.length === 0) {
        treeContainer.innerHTML = `<div class="loading-spinner"><span>No buckets or files found.</span></div>`;
        bucketNameSpan.textContent = 'No buckets';
        return;
      }

      // Identifica se estamos em modo multi-bucket ou single-bucket padrão
      const firstItem = items[0];
      if (firstItem.isBucket) {
        bucketNameSpan.textContent = 'All Buckets';
        this.currentBucket = '';
      } else {
        this.currentBucket = firstItem.bucket;
        bucketNameSpan.textContent = this.currentBucket;
      }

      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const nodeEl = this.createNodeElement(item, 0);
        fragment.appendChild(nodeEl);
      });
      treeContainer.appendChild(fragment);
      lucide.createIcons();

    } catch (err) {
      console.error('Erro ao carregar raiz:', err);
      treeContainer.innerHTML = `
        <div class="error-body" style="padding: 20px;">
          <i data-lucide="alert-triangle" class="error-icon" style="width: 32px; height: 32px;"></i>
          <h3>Connection Error</h3>
          <p style="font-size: 0.8rem;">Ensure MinIO is running and the credentials in .env are correct.</p>
          <button class="btn btn-secondary try-again-btn" style="margin-top: 10px;">Try again</button>
        </div>
      `;
      const tryAgainBtn = treeContainer.querySelector('.try-again-btn');
      if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => this.loadRootNodes());
      }
      bucketNameSpan.textContent = 'Error';
      lucide.createIcons();
    }
  }

  createNodeElement(item, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node-wrapper';

    const node = document.createElement('div');
    node.className = 'tree-node';
    if (item.isDir) {
      node.classList.add('folder-node');
    } else {
      node.classList.add('file-node');
    }
    
    node.dataset.path = item.path;
    node.dataset.bucket = item.bucket || '';
    node.dataset.depth = depth;
    node.dataset.isDir = item.isDir;
    node.dataset.name = item.name;
    node.dataset.size = item.size || 0;
    node.dataset.lastModified = item.lastModified || '';
    node.dataset.isBucket = item.isBucket ? 'true' : 'false';

    // Indentação
    if (depth > 0) {
      const indent = document.createElement('div');
      indent.className = 'tree-node-indent';
      indent.style.width = `${depth * 16}px`;
      node.appendChild(indent);
    }

    // Seta de expansão (somente pastas)
    const arrow = document.createElement('span');
    arrow.className = 'node-arrow';
    if (item.isDir) {
      arrow.innerHTML = '<i data-lucide="chevron-right"></i>';
    }
    node.appendChild(arrow);

    // Ícone correspondente
    const icon = document.createElement('i');
    icon.className = 'node-icon';
    if (item.isDir) {
      if (item.isBucket) {
        icon.className += ' database';
        icon.setAttribute('data-lucide', 'database');
      } else {
        icon.className += ' folder';
        icon.setAttribute('data-lucide', 'folder');
      }
    } else {
      const ext = item.name.split('.').pop().toLowerCase();
      if (ext === 'md') {
        icon.className += ' file-md';
        icon.setAttribute('data-lucide', 'file-text');
      } else if (['json', 'js', 'py', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
        icon.className += ' file-code';
        icon.setAttribute('data-lucide', 'code');
      } else {
        icon.className += ' file';
        icon.setAttribute('data-lucide', 'file');
      }
    }
    node.appendChild(icon);

    // Nome do arquivo ou pasta
    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = item.name;
    node.appendChild(label);

    // Botões de Ação Rápida (Excluir e Editar) - não mostrar para buckets
    if (!item.isBucket) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'node-actions';

      // Se for arquivo editável, mostra botão de edição
      if (!item.isDir) {
        const ext = item.name.split('.').pop().toLowerCase();
        const isEditable = ['md', 'txt', 'json', 'log', 'xml', 'js', 'py', 'html', 'css', 'yaml', 'yml', 'env', 'conf', 'ini'].includes(ext);
        if (isEditable) {
          const editAction = document.createElement('button');
          editAction.className = 'node-action-btn edit';
          editAction.title = 'Edit';
          editAction.innerHTML = '<i data-lucide="edit-3"></i>';
          editAction.addEventListener('click', async (e) => {
            e.stopPropagation();
            const url = `/api/file?bucket=${encodeURIComponent(item.bucket)}&path=${encodeURIComponent(item.path)}`;
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`Error fetching file: ${res.statusText}`);
              const content = await res.text();
              this.openEditModal(item.bucket, item.path, item.name, content);
            } catch (err) {
              alert(err.message);
            }
          });
          actionsContainer.appendChild(editAction);
        }
      }

      // Botão de excluir para arquivo ou pasta
      const deleteAction = document.createElement('button');
      deleteAction.className = 'node-action-btn delete';
      deleteAction.title = 'Delete';
      deleteAction.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteAction.addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptDelete(node);
      });
      actionsContainer.appendChild(deleteAction);

      node.appendChild(actionsContainer);
    }

    wrapper.appendChild(node);

    if (item.isDir) {
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'tree-children';
      childrenDiv.style.display = 'none';
      wrapper.appendChild(childrenDiv);

      // Clique simples na pasta para selecioná-la
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
        node.classList.add('active');
        this.currentFolder = node.dataset.path || '';
        this.currentBucket = node.dataset.bucket || '';
      });

      // Duplo clique na pasta para expandir ou recolher
      node.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.toggleFolder(node, childrenDiv);
      });

      // Clique simples na setinha para expandir ou recolher
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolder(node, childrenDiv);
      });
    } else {
      // Clique simples para abrir arquivos
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Destaca arquivo selecionado
        document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
        node.classList.add('active');

        // Atualiza pasta ativa e bucket para uploads
        const lastSlash = item.path.lastIndexOf('/');
        this.currentFolder = lastSlash !== -1 ? item.path.substring(0, lastSlash + 1) : '';
        this.currentBucket = item.bucket || '';

        this.loadFile(item.bucket, item.path, item.name, item.size, item.lastModified);
      });
    }

    return wrapper;
  }

  async toggleFolder(node, childrenDiv) {
    const arrow = node.querySelector('.node-arrow');
    const isExpanded = childrenDiv.style.display === 'block';

    if (isExpanded) {
      // Recolhe
      childrenDiv.style.display = 'none';
      if (arrow) {
        arrow.classList.remove('expanded');
      }
    } else {
      // Abre
      if (childrenDiv.dataset.loaded !== 'true') {
        // Salva ícone anterior para restaurar após carregamento
        const originalArrowHTML = arrow.innerHTML;
        arrow.innerHTML = '<span class="node-loading">...</span>';

        try {
          const bucket = node.dataset.bucket;
          const prefix = node.dataset.path;
          
          let url = `/api/files?bucket=${encodeURIComponent(bucket)}`;
          if (prefix) {
            url += `&prefix=${encodeURIComponent(prefix)}`;
          }
          
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
          const subItems = await res.json();
          
          childrenDiv.innerHTML = '';
          const depth = parseInt(node.dataset.depth, 10) + 1;

          if (subItems.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.padding = '4px 8px 4px ' + ((depth * 16) + 30) + 'px';
            emptyDiv.style.color = 'var(--text-secondary)';
            emptyDiv.style.fontSize = '0.8rem';
            emptyDiv.style.fontStyle = 'italic';
            emptyDiv.textContent = 'Empty folder';
            childrenDiv.appendChild(emptyDiv);
          } else {
            subItems.forEach(item => {
              const childEl = this.createNodeElement(item, depth);
              childrenDiv.appendChild(childEl);
            });
          }
          
          childrenDiv.dataset.loaded = 'true';
          arrow.innerHTML = originalArrowHTML;
          lucide.createIcons();
          
        } catch (err) {
          console.error('Erro ao expandir pasta:', err);
          arrow.innerHTML = originalArrowHTML;
          alert('Could not load subdirectories.');
          return;
        }
      }

      // Exibe os subelementos
      childrenDiv.style.display = 'block';
      if (arrow) {
        arrow.classList.add('expanded');
      }
    }
  }

  /* File Viewer Logic */
  async loadFile(bucket, path, name, size, lastModified) {
    const welcomeScreen = document.getElementById('welcome-screen');
    const markdownView = document.getElementById('markdown-view');
    const textView = document.getElementById('text-view');
    const errorView = document.getElementById('error-view');
    
    const header = document.getElementById('viewer-header');
    const headerName = document.getElementById('header-file-name');
    const headerPath = document.getElementById('header-file-path');
    const headerSize = document.getElementById('header-file-size');
    const rawBtn = document.getElementById('raw-btn');
    
    // Format sizes
    const bytes = parseInt(size, 10);
    let sizeText = '0 B';
    if (bytes >= 1024 * 1024) {
      sizeText = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else if (bytes >= 1024) {
      sizeText = (bytes / 1024).toFixed(1) + ' KB';
    } else {
      sizeText = bytes + ' B';
    }

    // Update Header Metadata
    headerName.textContent = name;
    headerPath.textContent = `${bucket}/${path}`;
    headerSize.textContent = sizeText;
    header.style.display = 'flex';

    // Store active file metadata
    this.activeFileMeta = { bucket, path, name, size, lastModified };

    // Set file-specific icon and edit button visibility
    const editBtn = document.getElementById('edit-btn');
    const ext = name.split('.').pop().toLowerCase();
    const isEditable = ['md', 'txt', 'json', 'log', 'xml', 'js', 'py', 'html', 'css', 'yaml', 'yml', 'env', 'conf', 'ini'].includes(ext);
    if (isEditable) {
      editBtn.style.display = 'inline-flex';
    } else {
      editBtn.style.display = 'none';
    }

    // Config Raw file link opening
    rawBtn.onclick = () => {
      window.open(`/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, '_blank');
    };

    // Set file-specific icon
    const headerIcon = document.getElementById('header-file-icon');
    headerIcon.removeAttribute('data-lucide');
    if (ext === 'md') {
      headerIcon.setAttribute('data-lucide', 'file-text');
    } else if (['json', 'js', 'py', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
      headerIcon.setAttribute('data-lucide', 'code');
    } else {
      headerIcon.setAttribute('data-lucide', 'file');
    }
    lucide.createIcons();

    // Reset viewport layouts
    welcomeScreen.style.display = 'none';
    markdownView.style.display = 'none';
    textView.style.display = 'none';
    errorView.style.display = 'none';
    
    // Clean views
    markdownView.innerHTML = '';
    textView.innerHTML = '';
    this.currentViewerEditor = null;

    // Match registered viewers
    const viewer = this.viewers.find(v => v.test(name)) || this.fallbackViewer;
    
    // Create dynamic loader inside viewer
    const loader = document.createElement('div');
    loader.className = 'loading-spinner';
    loader.style.marginTop = '60px';
    loader.innerHTML = '<div class="spinner"></div><span>Loading file...</span>';
    document.getElementById('viewer-content').appendChild(loader);

    try {
      if (viewer.name === 'Markdown') {
        await viewer.render(bucket, path, markdownView);
        markdownView.style.display = 'block';
      } else if (viewer.name === 'Text/JSON') {
        textView.style.display = 'block';
        await viewer.render(bucket, path, textView);
        if (this.currentViewerEditor) {
          setTimeout(() => {
            this.currentViewerEditor.refresh();
          }, 50);
        }
      } else {
        await viewer.render(bucket, path, markdownView); // standard fallback target
        markdownView.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro de renderização:', err);
      document.getElementById('error-title').textContent = 'Error Loading';
      document.getElementById('error-message').textContent = err.message;
      errorView.style.display = 'flex';
    } finally {
      loader.remove();
    }
  }

  /* Extensible Render Methods */
  async renderMarkdown(bucket, path, container) {
    const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load markdown file (${res.statusText})`);
    const text = await res.text();
    
    // Parse markdown to HTML
    const htmlContent = marked.parse(text);
    
    // Sanitize the HTML to prevent XSS
    const cleanHtml = DOMPurify.sanitize(htmlContent);
    
    // Set content
    container.innerHTML = cleanHtml;
    
    // Post-process and render Mermaid diagrams
    await this.renderMermaidDiagrams(container);

    // Syntax highlight other code blocks using Highlight.js
    container.querySelectorAll('pre code').forEach((el) => {
      if (!el.classList.contains('language-mermaid') && !el.classList.contains('mermaid')) {
        hljs.highlightElement(el);
      }
    });
  }

  async renderTextOrJson(bucket, path, container) {
    const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load text file (${res.statusText})`);
    const text = await res.text();
    
    container.innerHTML = '<div id="text-viewer-editor-container"></div>';
    const editorContainer = container.querySelector('#text-viewer-editor-container');
    
    const ext = path.split('.').pop().toLowerCase();
    let mode = 'text/plain';
    if (ext === 'json') mode = 'application/json';
    else if (ext === 'js') mode = 'javascript';
    else if (ext === 'py') mode = 'python';
    else if (ext === 'html') mode = 'htmlmixed';
    else if (ext === 'css') mode = 'css';
    else if (ext === 'yaml' || ext === 'yml') mode = 'yaml';
    else if (ext === 'xml') mode = 'xml';
    else if (ext === 'md') mode = 'markdown';
    
    let displayContent = text;
    if (ext === 'json') {
      try {
        displayContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {
        // Keep raw
      }
    }
    
    const activeTheme = localStorage.getItem('minio-editor-theme') || 'dracula';
    
    this.currentViewerEditor = CodeMirror(editorContainer, {
      value: displayContent,
      mode: mode,
      theme: activeTheme,
      lineNumbers: true,
      readOnly: 'nocursor',
      lineWrapping: true
    });
  }

  async renderFallback(bucket, path, container) {
    container.innerHTML = `
      <div class="error-body">
        <i data-lucide="file-warning" class="error-icon" style="color: var(--warning-yellow)"></i>
        <h3>Preview not supported</h3>
        <p>This file format cannot be viewed directly.</p>
        <p style="font-size: 0.8rem; margin-top: 10px;">
          You can open the raw content in a new tab by clicking the <strong>Raw</strong> button above.
        </p>
      </div>
    `;
    lucide.createIcons();
  }

  /* Mermaid Rendering Integrator */
  async renderMermaidDiagrams(container) {
    const codeBlocks = container.querySelectorAll('pre code.language-mermaid, pre code.mermaid');
    if (codeBlocks.length === 0) return;

    const blocksToRender = [];
    
    codeBlocks.forEach((codeEl, index) => {
      const preEl = codeEl.parentElement;
      const codeText = codeEl.textContent.trim();
      
      const wrapperDiv = document.createElement('div');
      wrapperDiv.className = 'mermaid-container';
      wrapperDiv.id = `mermaid-container-${index}`;
      wrapperDiv.dataset.diagram = codeText;
      
      preEl.parentNode.replaceChild(wrapperDiv, preEl);
      blocksToRender.push({ element: wrapperDiv, text: codeText });
    });

    // Init mermaid configurations
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose'
    });

    for (const block of blocksToRender) {
      try {
        const id = block.element.id;
        // Render svg
        const { svg } = await mermaid.render(`${id}-svg`, block.text);
        block.element.innerHTML = svg;
        
        // Click event handles full screen Zoom/Pan modal popup
        block.element.addEventListener('click', () => {
          this.openMermaidModal(block.text);
        });
      } catch (err) {
        console.error('Erro de diagramação Mermaid:', err);
        // Exibe erro explicativo amigável no lugar do bloco
        block.element.innerHTML = `
          <div style="color: var(--error-red); padding: 12px; font-size: 0.8rem; font-family: var(--font-mono); border: 1px dashed var(--error-red); border-radius: 6px;">
            <strong>[Mermaid Diagram Error]</strong><br>${err.message}
          </div>
        `;
        // Limpa qualquer classe que impeça renderizações futuras
        block.element.removeAttribute('style');
      }
    }
  }

  /* Pan & Zoom Modal Controller */
  initModal() {
    const modal = document.getElementById('mermaid-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const backdrop = document.getElementById('modal-backdrop');
    
    const zoomIn = document.getElementById('zoom-in-btn');
    const zoomOut = document.getElementById('zoom-out-btn');
    const zoomReset = document.getElementById('zoom-reset-btn');

    const closeModal = () => {
      modal.style.display = 'none';
      if (this.panzoomInstance) {
        this.panzoomInstance.destroy();
        this.panzoomInstance = null;
      }
    };

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    // Close with Esc key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    zoomIn.addEventListener('click', () => {
      if (this.panzoomInstance) this.panzoomInstance.zoomIn();
    });

    zoomOut.addEventListener('click', () => {
      if (this.panzoomInstance) this.panzoomInstance.zoomOut();
    });

    zoomReset.addEventListener('click', () => {
      if (this.panzoomInstance) this.panzoomInstance.reset();
    });
  }

  async openMermaidModal(diagramText) {
    const modal = document.getElementById('mermaid-modal');
    const target = document.getElementById('modal-diagram-target');
    
    target.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Processing diagram...</span>
      </div>
    `;
    modal.style.display = 'flex';

    try {
      // Render diagram specifically for modal display
      const { svg } = await mermaid.render('modal-svg-render', diagramText);
      target.innerHTML = svg;
      
      const svgElement = target.querySelector('svg');
      
      // Style svg elements inside modal to expand but center correctly
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.style.maxWidth = 'none';
      svgElement.style.maxHeight = 'none';
      
      // Initialize Panzoom library logic
      this.panzoomInstance = Panzoom(svgElement, {
        maxScale: 10,
        minScale: 0.1,
        contain: 'outside',
        duration: 200
      });

      // Zoom bindings with mouse wheel
      const panContainer = document.getElementById('panzoom-container');
      panContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.panzoomInstance.zoomWithWheel(e);
      });

    } catch (err) {
      console.error('Error processing diagram modal:', err);
      target.innerHTML = `
        <div class="error-body">
          <i data-lucide="alert-octagon" class="error-icon"></i>
          <h3>Modal Failure</h3>
          <p>Could not render the interactive diagram. (${err.message})</p>
        </div>
      `;
      lucide.createIcons();
    }
  }

  /* Edit File Modal logic */
  initEditModal() {
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('edit-close-btn');
    const backdrop = document.getElementById('edit-modal-backdrop');
    const themeSelect = document.getElementById('editor-theme-select');
    
    const closeModal = () => {
      modal.style.display = 'none';
    };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    // Close with Esc key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
    
    themeSelect.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      localStorage.setItem('minio-editor-theme', newTheme);
      
      if (this.editEditorInstance) {
        this.editEditorInstance.setOption('theme', newTheme);
      }
      if (this.currentViewerEditor) {
        this.currentViewerEditor.setOption('theme', newTheme);
      }
    });

    const editBtn = document.getElementById('edit-btn');
    editBtn.addEventListener('click', async () => {
      if (!this.activeFileMeta) return;
      const { bucket, path, name } = this.activeFileMeta;
      
      const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error fetching file: ${res.statusText}`);
        const content = await res.text();
        this.openEditModal(bucket, path, name, content);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  openEditModal(bucket, path, filename, content) {
    const modal = document.getElementById('edit-modal');
    document.getElementById('edit-file-name').textContent = filename;
    document.getElementById('edit-file-path').textContent = `${bucket}/${path}`;
    
    const ext = filename.split('.').pop().toLowerCase();
    let mode = 'text/plain';
    if (ext === 'json') mode = 'application/json';
    else if (ext === 'js') mode = 'javascript';
    else if (ext === 'py') mode = 'python';
    else if (ext === 'html') mode = 'htmlmixed';
    else if (ext === 'css') mode = 'css';
    else if (ext === 'yaml' || ext === 'yml') mode = 'yaml';
    else if (ext === 'xml') mode = 'xml';
    else if (ext === 'md') mode = 'markdown';
    
    const activeTheme = localStorage.getItem('minio-editor-theme') || 'dracula';
    document.getElementById('editor-theme-select').value = activeTheme;
    
    const textarea = document.getElementById('editor-textarea');
    modal.style.display = 'flex';
    
    if (!this.editEditorInstance) {
      textarea.value = content;
      this.editEditorInstance = CodeMirror.fromTextArea(textarea, {
        lineNumbers: true,
        lineWrapping: true,
        theme: activeTheme,
        mode: mode
      });
    } else {
      this.editEditorInstance.setValue(content);
      this.editEditorInstance.setOption('mode', mode);
      this.editEditorInstance.setOption('theme', activeTheme);
    }
    
    setTimeout(() => {
      this.editEditorInstance.refresh();
    }, 100);
    
    const saveBtn = document.getElementById('edit-save-btn');
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
    
    saveBtn.onclick = async () => {
      const updatedContent = this.editEditorInstance.getValue();
      saveStatus.textContent = 'Saving...';
      saveStatus.className = 'save-status';
      
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, path, content: updatedContent })
        });
        
        if (!res.ok) throw new Error(await res.text() || 'Failed to save');
        
        saveStatus.textContent = 'File saved successfully!';
        saveStatus.className = 'save-status success';
        
        await this.loadFile(bucket, path, filename, updatedContent.length, new Date().toISOString());
        
        setTimeout(() => {
          modal.style.display = 'none';
        }, 800);
        
      } catch (err) {
        saveStatus.textContent = 'Error saving: ' + err.message;
        saveStatus.className = 'save-status error';
      }
    };
  }

  /* Delete File/Folder logic */
  initDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const closeBtn = document.getElementById('delete-close-btn');
    const cancelBtn = document.getElementById('delete-cancel-btn');
    const backdrop = document.getElementById('delete-modal-backdrop');
    const confirmBtn = document.getElementById('delete-confirm-btn');
    
    const closeModal = () => {
      modal.style.display = 'none';
      this.nodeToDelete = null;
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    // Close with Esc key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
    
    confirmBtn.addEventListener('click', async () => {
      if (!this.nodeToDelete) return;
      
      const path = this.nodeToDelete.dataset.path;
      const bucket = this.nodeToDelete.dataset.bucket;
      const isDir = this.nodeToDelete.dataset.isDir === 'true';
      
      try {
        const res = await fetch(`/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&isDir=${isDir}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) throw new Error(await res.text() || 'Failed to delete');
        
        const nodeToRefresh = this.nodeToDelete;
        closeModal();
        
        if (this.activeFileMeta && this.activeFileMeta.bucket === bucket && this.activeFileMeta.path === path) {
          this.resetViewerToWelcome();
        }
        
        await this.refreshParentOfNode(nodeToRefresh);
        
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    });
  }

  promptDelete(node) {
    this.nodeToDelete = node;
    const path = node.dataset.path;
    const bucket = node.dataset.bucket;
    const isDir = node.dataset.isDir === 'true';
    
    const modal = document.getElementById('delete-modal');
    const pathSpan = document.getElementById('delete-item-path');
    const icon = document.getElementById('delete-item-icon');
    const warningText = document.getElementById('delete-warning-text');
    
    pathSpan.textContent = `${bucket}/${path}`;
    
    icon.removeAttribute('data-lucide');
    if (isDir) {
      icon.setAttribute('data-lucide', 'folder');
      warningText.innerHTML = '<i data-lucide="alert-triangle"></i> Warning: This will recursively delete the folder and all of its files!';
    } else {
      icon.setAttribute('data-lucide', 'file');
      warningText.innerHTML = '<i data-lucide="alert-triangle"></i> This action cannot be undone!';
    }
    
    lucide.createIcons();
    modal.style.display = 'flex';
  }

  resetViewerToWelcome() {
    this.activeFileMeta = null;
    document.getElementById('viewer-header').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('markdown-view').style.display = 'none';
    document.getElementById('text-view').style.display = 'none';
    document.getElementById('error-view').style.display = 'none';
    document.getElementById('edit-btn').style.display = 'none';
  }

  getParentFolderNode(childNode) {
    const parentChildrenDiv = childNode.closest('.tree-children');
    if (parentChildrenDiv) {
      return parentChildrenDiv.previousElementSibling;
    }
    return null;
  }

  async refreshFolder(node) {
    const childrenDiv = node.nextElementSibling;
    if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
      // If expanded, collapse and reload. Otherwise just mark as not loaded so next expand fetches fresh data.
      if (childrenDiv.style.display === 'block') {
        childrenDiv.dataset.loaded = 'false';
        childrenDiv.style.display = 'none';
        const arrow = node.querySelector('.node-arrow');
        if (arrow) arrow.classList.remove('expanded');
        await this.toggleFolder(node, childrenDiv);
      } else {
        childrenDiv.dataset.loaded = 'false';
      }
    }
  }

  async refreshParentOfNode(node) {
    const parentNode = this.getParentFolderNode(node);
    if (parentNode) {
      await this.refreshFolder(parentNode);
    } else {
      await this.loadRootNodes();
    }
  }

  /* Upload Manager Logic */
  initUploadManager() {
    const globalInput = document.getElementById('global-file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const dragOverlay = document.getElementById('drag-drop-overlay');
    const uploadManager = document.getElementById('upload-manager');
    const uploadList = document.getElementById('upload-list');
    const minimizeBtn = document.getElementById('upload-minimize-btn');
    const closeBtn = document.getElementById('upload-close-btn');
    const managerHeader = document.getElementById('upload-manager-header');

    // Trigger file selection on button click
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.currentBucket) {
        alert('Please select a bucket or folder first by expanding or selecting a directory.');
        return;
      }
      globalInput.value = '';
      globalInput.click();
    });

    // Handle manual file selection
    globalInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.queueFiles(e.target.files);
      }
    });

    // Minimize toggle behavior
    const toggleMinimize = (e) => {
      // Don't minimize if user clicked control buttons
      if (e.target.closest('#upload-minimize-btn') || e.target.closest('#upload-close-btn')) {
        return;
      }
      uploadManager.classList.toggle('minimized');
      const icon = minimizeBtn.querySelector('i');
      if (icon) {
        if (uploadManager.classList.contains('minimized')) {
          icon.setAttribute('data-lucide', 'plus');
        } else {
          icon.setAttribute('data-lucide', 'minus');
        }
        lucide.createIcons();
      }
    };
    
    minimizeBtn.addEventListener('click', () => {
      uploadManager.classList.toggle('minimized');
      const icon = minimizeBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', uploadManager.classList.contains('minimized') ? 'plus' : 'minus');
        lucide.createIcons();
      }
    });

    managerHeader.addEventListener('click', toggleMinimize);

    // Close button clears the queue and hides the panel, but only when not actively uploading
    closeBtn.addEventListener('click', () => {
      if (this.isUploading) {
        alert('Cannot close while uploads are in progress.');
        return;
      }
      uploadManager.style.display = 'none';
      uploadList.innerHTML = '';
      this.uploadQueue = [];
    });

    // Drag and Drop Overlay Logic
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      
      const titleEl = document.getElementById('drag-drop-title');
      const subtitleEl = document.getElementById('drag-drop-subtitle');
      const iconEl = dragOverlay.querySelector('.drag-icon');

      if (!this.currentBucket) {
        titleEl.textContent = 'Upload Disabled';
        subtitleEl.textContent = 'Please select a bucket or folder first';
        iconEl.setAttribute('data-lucide', 'alert-circle');
        dragOverlay.style.border = '4px dashed var(--error-red)';
        dragOverlay.style.color = 'var(--error-red)';
      } else {
        titleEl.textContent = 'Drop files to upload';
        const folderDisplay = this.currentFolder ? `/${this.currentFolder}` : '';
        subtitleEl.textContent = `Uploading to: ${this.currentBucket}${folderDisplay}`;
        iconEl.setAttribute('data-lucide', 'upload-cloud');
        dragOverlay.style.border = '4px dashed var(--accent-blue)';
        dragOverlay.style.color = 'var(--accent-blue)';
      }
      lucide.createIcons();
      dragOverlay.style.display = 'flex';
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = this.currentBucket ? 'copy' : 'none';
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        dragOverlay.style.display = 'none';
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dragOverlay.style.display = 'none';

      if (!this.currentBucket) {
        alert('Please select a bucket or folder first to upload files.');
        return;
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.queueFiles(e.dataTransfer.files);
      }
    });
  }

  queueFiles(fileList) {
    const uploadManager = document.getElementById('upload-manager');
    const uploadList = document.getElementById('upload-list');

    // Make sure panel is visible and expanded
    uploadManager.style.display = 'flex';
    uploadManager.classList.remove('minimized');
    const minIcon = document.getElementById('upload-minimize-btn').querySelector('i');
    if (minIcon) {
      minIcon.setAttribute('data-lucide', 'minus');
    }

    // Add files to our state queue
    Array.from(fileList).forEach(file => {
      const item = {
        id: 'upload-' + Math.random().toString(36).substring(2, 9),
        file: file,
        name: file.name,
        size: file.size,
        bucket: this.currentBucket,
        folder: this.currentFolder,
        progress: 0,
        status: 'pending'
      };

      this.uploadQueue.push(item);
      this.createUploadItemUI(item);
    });

    lucide.createIcons();
    this.processUploadQueue();
  }

  createUploadItemUI(item) {
    const uploadList = document.getElementById('upload-list');
    const li = document.createElement('li');
    li.className = 'upload-item';
    li.id = item.id;

    // Convert file size to readable text
    let sizeText = '0 B';
    if (item.size >= 1024 * 1024) sizeText = (item.size / (1024 * 1024)).toFixed(1) + ' MB';
    else if (item.size >= 1024) sizeText = (item.size / 1024).toFixed(1) + ' KB';
    else sizeText = item.size + ' B';

    li.innerHTML = `
      <div class="upload-item-header">
        <span class="upload-item-name" title="${item.name}">${item.name} (${sizeText})</span>
        <span class="upload-item-status-icon" id="${item.id}-status-icon">
          <i data-lucide="clock" style="color: var(--text-secondary); width: 14px; height: 14px;"></i>
        </span>
      </div>
      <div class="upload-item-progress-container">
        <div class="upload-item-progress-bar-bg">
          <div class="upload-item-progress-bar-fill" id="${item.id}-bar" style="width: 0%;"></div>
        </div>
        <span class="upload-item-progress-text" id="${item.id}-text">0%</span>
      </div>
    `;

    uploadList.appendChild(li);
    
    // Scroll to bottom of list
    const body = document.getElementById('upload-manager-body');
    body.scrollTop = body.scrollHeight;
  }

  updateUploadItemUI(item) {
    const bar = document.getElementById(`${item.id}-bar`);
    const text = document.getElementById(`${item.id}-text`);
    const statusIcon = document.getElementById(`${item.id}-status-icon`);
    const li = document.getElementById(item.id);

    if (bar) bar.style.width = `${item.progress}%`;
    if (text) text.textContent = `${item.progress}%`;

    if (item.status === 'uploading') {
      statusIcon.innerHTML = '<i data-lucide="loader" class="spinner-icon" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i>';
    } else if (item.status === 'success') {
      li.classList.add('success');
      statusIcon.innerHTML = '<i data-lucide="check" class="upload-item-status-icon success" style="width: 14px; height: 14px;"></i>';
    } else if (item.status === 'error') {
      li.classList.add('error');
      statusIcon.innerHTML = `<i data-lucide="alert-triangle" class="upload-item-status-icon error" title="${item.error}" style="width: 14px; height: 14px;"></i>`;
    }
    lucide.createIcons();
  }

  async processUploadQueue() {
    if (this.isUploading) return;

    // Find next pending file
    const item = this.uploadQueue.find(x => x.status === 'pending');

    const managerIconContainer = document.getElementById('upload-manager-icon-container');
    const managerText = document.getElementById('upload-manager-text');

    if (!item) {
      // Queue is finished
      this.isUploading = false;
      
      const totalCount = this.uploadQueue.length;
      const errorCount = this.uploadQueue.filter(x => x.status === 'error').length;
      
      if (errorCount === 0) {
        managerText.textContent = `All ${totalCount} uploads completed!`;
        if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="check" class="spinner-icon success"></i>';
      } else {
        managerText.textContent = `Completed with ${errorCount} errors`;
        if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="alert-triangle" class="spinner-icon error"></i>';
      }
      lucide.createIcons();

      // Refresh the corresponding folders where changes happened
      const foldersToRefresh = new Set();
      this.uploadQueue.forEach(q => {
        if (q.status === 'success') {
          foldersToRefresh.add(JSON.stringify({ bucket: q.bucket, folder: q.folder }));
        }
      });

      for (const fJson of foldersToRefresh) {
        const { bucket, folder } = JSON.parse(fJson);
        const folderNode = this.findFolderNode(bucket, folder);
        if (folderNode) {
          await this.refreshFolder(folderNode);
        } else {
          // If no node matches, we reload the tree root
          await this.loadRootNodes();
        }
      }
      return;
    }

    // Process this item
    this.isUploading = true;
    item.status = 'uploading';
    this.updateUploadItemUI(item);

    // Update global manager title
    const totalCount = this.uploadQueue.length;
    const currentIndex = this.uploadQueue.indexOf(item) + 1;
    managerText.textContent = `Uploading file ${currentIndex} of ${totalCount}...`;
    if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="loader" class="spinner-icon" style="animation: spin 1s linear infinite;"></i>';
    lucide.createIcons();

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('bucket', item.bucket);
    
    // Set file destination path
    const destinationPath = item.folder ? `${item.folder}${item.name}` : item.name;
    formData.append('path', destinationPath);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        // Cap progress at 99% during upload, set to 100% on server response confirmation
        item.progress = Math.min(percent, 99);
        this.updateUploadItemUI(item);
      }
    });

    xhr.addEventListener('load', () => {
      this.isUploading = false;
      if (xhr.status >= 200 && xhr.status < 300) {
        item.status = 'success';
        item.progress = 100;
      } else {
        item.status = 'error';
        item.error = xhr.responseText || 'Upload failed';
        item.progress = 100;
      }
      this.updateUploadItemUI(item);
      this.processUploadQueue();
    });

    xhr.addEventListener('error', () => {
      this.isUploading = false;
      item.status = 'error';
      item.error = 'Network connection failed';
      item.progress = 100;
      this.updateUploadItemUI(item);
      this.processUploadQueue();
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  findFolderNode(bucket, path) {
    // Return matching folder tree element
    // Standardize paths (removing trailing slash for lookup name comparisons)
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    if (!normalizedPath) {
      // If path is empty, it means we want the bucket node itself
      return Array.from(document.querySelectorAll('.tree-node.folder-node')).find(node => {
        return node.dataset.bucket === bucket && node.dataset.isBucket === 'true';
      });
    }

    return Array.from(document.querySelectorAll('.tree-node.folder-node')).find(node => {
      const nodePath = node.dataset.path || '';
      const normalizedNodePath = nodePath.endsWith('/') ? nodePath.slice(0, -1) : nodePath;
      return node.dataset.bucket === bucket && normalizedNodePath === normalizedPath;
    });
  }

  async refreshFolder(node) {
    const childrenDiv = node.nextElementSibling;
    if (childrenDiv && childrenDiv.classList.contains('tree-children')) {
      // If expanded, collapse and reload. Otherwise just mark as not loaded so next expand fetches fresh data.
      if (childrenDiv.style.display === 'block') {
        childrenDiv.dataset.loaded = 'false';
        childrenDiv.style.display = 'none';
        const arrow = node.querySelector('.node-arrow');
        if (arrow) arrow.classList.remove('expanded');
        await this.toggleFolder(node, childrenDiv);
      } else {
        childrenDiv.dataset.loaded = 'false';
      }
    }
  }

  async refreshParentOfNode(node) {
    if (!node) {
      await this.loadRootNodes();
      return;
    }
    const parentNode = this.getParentFolderNode(node);
    if (parentNode) {
      await this.refreshFolder(parentNode);
    } else {
      await this.loadRootNodes();
    }
  }
}

// Instantiate and initialize the app
const app = new MinIONavigator();
app.init();
