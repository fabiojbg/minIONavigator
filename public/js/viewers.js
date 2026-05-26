export class ViewerManager {
  constructor(app) {
    this.app = app;

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
    
    const bytes = parseInt(size, 10);
    let sizeText = '0 B';
    if (bytes >= 1024 * 1024) {
      sizeText = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    } else if (bytes >= 1024) {
      sizeText = (bytes / 1024).toFixed(1) + ' KB';
    } else {
      sizeText = bytes + ' B';
    }

    headerName.textContent = name;
    headerPath.textContent = `${bucket}/${path}`;
    headerSize.textContent = sizeText;
    header.style.display = 'flex';

    this.app.activeFileMeta = { bucket, path, name, size, lastModified };

    const editBtn = document.getElementById('edit-btn');
    const ext = name.split('.').pop().toLowerCase();
    const isEditable = ['md', 'txt', 'json', 'log', 'xml', 'js', 'py', 'html', 'css', 'yaml', 'yml', 'env', 'conf', 'ini'].includes(ext);
    if (isEditable) {
      editBtn.style.display = 'inline-flex';
    } else {
      editBtn.style.display = 'none';
    }

    rawBtn.onclick = () => {
      window.open(`/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, '_blank');
    };

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

    welcomeScreen.style.display = 'none';
    markdownView.style.display = 'none';
    textView.style.display = 'none';
    errorView.style.display = 'none';
    
    markdownView.innerHTML = '';
    textView.innerHTML = '';
    this.app.currentViewerEditor = null;

    const viewer = this.viewers.find(v => v.test(name)) || this.fallbackViewer;
    
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
        if (this.app.currentViewerEditor) {
          setTimeout(() => {
            this.app.currentViewerEditor.refresh();
          }, 50);
        }
      } else {
        await viewer.render(bucket, path, markdownView);
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

  async renderMarkdown(bucket, path, container) {
    const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load markdown file (${res.statusText})`);
    const text = await res.text();
    
    const htmlContent = marked.parse(text);
    const cleanHtml = DOMPurify.sanitize(htmlContent);
    container.innerHTML = cleanHtml;
    
    await this.renderMermaidDiagrams(container);

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
    
    this.app.currentViewerEditor = CodeMirror(editorContainer, {
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

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose'
    });

    for (const block of blocksToRender) {
      try {
        const id = block.element.id;
        const { svg } = await mermaid.render(`${id}-svg`, block.text);
        block.element.innerHTML = svg;
        
        block.element.addEventListener('click', () => {
          this.app.modalManager.openMermaidModal(block.text);
        });
      } catch (err) {
        console.error('Erro de diagramação Mermaid:', err);
        block.element.innerHTML = `
          <div style="color: var(--error-red); padding: 12px; font-size: 0.8rem; font-family: var(--font-mono); border: 1px dashed var(--error-red); border-radius: 6px;">
            <strong>[Mermaid Diagram Error]</strong><br>${err.message}
          </div>
        `;
        block.element.removeAttribute('style');
      }
    }
  }
}
