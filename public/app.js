// Application State
let currentBucket = '';
let isResizing = false;

// Extensible Viewer Registry
const viewers = [
  {
    name: 'Markdown',
    test: (filename) => filename.endsWith('.md'),
    render: async (bucket, path, container) => {
      const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Não foi possível carregar o arquivo markdown (${res.statusText})`);
      const text = await res.text();
      
      // Parse markdown to HTML
      const htmlContent = marked.parse(text);
      
      // Sanitize the HTML to prevent XSS
      const cleanHtml = DOMPurify.sanitize(htmlContent);
      
      // Set content
      container.innerHTML = cleanHtml;
      
      // Post-process and render Mermaid diagrams
      await renderMermaidDiagrams(container);
    }
  },
  {
    name: 'Text/JSON',
    test: (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      return ['txt', 'json', 'log', 'xml', 'js', 'py', 'html', 'css', 'yaml', 'yml', 'env', 'conf', 'ini'].includes(ext);
    },
    render: async (bucket, path, container) => {
      const url = `/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Não foi possível carregar o arquivo de texto (${res.statusText})`);
      const text = await res.text();
      
      const codeEl = container.querySelector('#text-content');
      if (codeEl) {
        // Formata JSON de forma legível
        const ext = path.split('.').pop().toLowerCase();
        if (ext === 'json') {
          try {
            const jsonVal = JSON.parse(text);
            codeEl.textContent = JSON.stringify(jsonVal, null, 2);
          } catch (e) {
            codeEl.textContent = text;
          }
        } else {
          codeEl.textContent = text;
        }
      }
    }
  }
];

const fallbackViewer = {
  name: 'Default Fallback',
  render: async (bucket, path, container) => {
    container.innerHTML = `
      <div class="error-body">
        <i data-lucide="file-warning" class="error-icon" style="color: var(--warning-yellow)"></i>
        <h3>Visualização não suportada</h3>
        <p>Este formato de arquivo não pode ser visualizado diretamente.</p>
        <p style="font-size: 0.8rem; margin-top: 10px;">
          Você pode abrir o conteúdo bruto em uma nova aba clicando no botão <strong>Raw</strong> acima.
        </p>
      </div>
    `;
    lucide.createIcons();
  }
};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  initSplitter();
  initTreeview();
  initModal();
  lucide.createIcons();
});

/* Splitter Logic */
function initSplitter() {
  const splitter = document.getElementById('splitter');
  const sidebar = document.getElementById('sidebar');

  splitter.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    splitter.classList.add('active');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 220 && newWidth <= 600) {
      sidebar.style.width = `${newWidth}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      splitter.classList.remove('active');
    }
  });
}

/* Treeview Logic */
async function initTreeview() {
  const treeContainer = document.getElementById('tree-container');
  const refreshBtn = document.getElementById('refresh-btn');

  refreshBtn.addEventListener('click', () => {
    loadRootNodes();
  });

  await loadRootNodes();
}

async function loadRootNodes() {
  const treeContainer = document.getElementById('tree-container');
  const bucketNameSpan = document.getElementById('current-bucket-name');
  
  treeContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span>Buscando raiz...</span>
    </div>
  `;

  try {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error(`Status: ${res.statusText}`);
    const items = await res.json();
    
    treeContainer.innerHTML = '';
    
    if (items.length === 0) {
      treeContainer.innerHTML = `<div class="loading-spinner"><span>Nenhum bucket ou arquivo encontrado.</span></div>`;
      bucketNameSpan.textContent = 'Nenhum bucket';
      return;
    }

    // Identifica se estamos em modo multi-bucket ou single-bucket padrão
    const firstItem = items[0];
    if (firstItem.isBucket) {
      bucketNameSpan.textContent = 'Todos os Buckets';
      currentBucket = '';
    } else {
      currentBucket = firstItem.bucket;
      bucketNameSpan.textContent = currentBucket;
    }

    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const nodeEl = createNodeElement(item, 0);
      fragment.appendChild(nodeEl);
    });
    treeContainer.appendChild(fragment);
    lucide.createIcons();

  } catch (err) {
    console.error('Erro ao carregar raiz:', err);
    treeContainer.innerHTML = `
      <div class="error-body" style="padding: 20px;">
        <i data-lucide="alert-triangle" class="error-icon" style="width: 32px; height: 32px;"></i>
        <h3>Erro de Conexão</h3>
        <p style="font-size: 0.8rem;">Verifique se o MinIO está rodando e as credenciais no .env estão corretas.</p>
        <button class="btn btn-secondary" style="margin-top: 10px;" onclick="loadRootNodes()">Tentar novamente</button>
      </div>
    `;
    bucketNameSpan.textContent = 'Erro';
    lucide.createIcons();
  }
}

function createNodeElement(item, depth) {
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

  wrapper.appendChild(node);

  if (item.isDir) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    childrenDiv.style.display = 'none';
    wrapper.appendChild(childrenDiv);

    // Duplo clique na pasta para expandir ou recolher
    node.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      toggleFolder(node, childrenDiv);
    });

    // Clique simples na setinha para expandir ou recolher
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFolder(node, childrenDiv);
    });
  } else {
    // Clique simples para abrir arquivos
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Destaca arquivo selecionado
      document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
      node.classList.add('active');

      loadFile(item.bucket, item.path, item.name, item.size, item.lastModified);
    });
  }

  return wrapper;
}

async function toggleFolder(node, childrenDiv) {
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
        if (!res.ok) throw new Error(`Falha: ${res.statusText}`);
        const subItems = await res.json();
        
        childrenDiv.innerHTML = '';
        const depth = parseInt(node.dataset.depth, 10) + 1;

        if (subItems.length === 0) {
          const emptyDiv = document.createElement('div');
          emptyDiv.style.padding = '4px 8px 4px ' + ((depth * 16) + 30) + 'px';
          emptyDiv.style.color = 'var(--text-secondary)';
          emptyDiv.style.fontSize = '0.8rem';
          emptyDiv.style.fontStyle = 'italic';
          emptyDiv.textContent = 'Pasta vazia';
          childrenDiv.appendChild(emptyDiv);
        } else {
          subItems.forEach(item => {
            const childEl = createNodeElement(item, depth);
            childrenDiv.appendChild(childEl);
          });
        }
        
        childrenDiv.dataset.loaded = 'true';
        arrow.innerHTML = originalArrowHTML;
        lucide.createIcons();
        
      } catch (err) {
        console.error('Erro ao expandir pasta:', err);
        arrow.innerHTML = originalArrowHTML;
        alert('Não foi possível carregar os subdiretórios.');
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
async function loadFile(bucket, path, name, size, lastModified) {
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

  // Config Raw file link opening
  rawBtn.onclick = () => {
    window.open(`/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, '_blank');
  };

  // Set file-specific icon
  const headerIcon = document.getElementById('header-file-icon');
  const ext = name.split('.').pop().toLowerCase();
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
  document.getElementById('text-content').textContent = '';

  // Match registered viewers
  const viewer = viewers.find(v => v.test(name)) || fallbackViewer;
  
  // Create dynamic loader inside viewer
  const loader = document.createElement('div');
  loader.className = 'loading-spinner';
  loader.style.marginTop = '60px';
  loader.innerHTML = '<div class="spinner"></div><span>Carregando arquivo...</span>';
  document.getElementById('viewer-content').appendChild(loader);

  try {
    if (viewer.name === 'Markdown') {
      await viewer.render(bucket, path, markdownView);
      markdownView.style.display = 'block';
    } else if (viewer.name === 'Text/JSON') {
      await viewer.render(bucket, path, textView);
      textView.style.display = 'block';
    } else {
      await viewer.render(bucket, path, markdownView); // standard fallback target
      markdownView.style.display = 'block';
    }
  } catch (err) {
    console.error('Erro de renderização:', err);
    document.getElementById('error-title').textContent = 'Erro ao Carregar';
    document.getElementById('error-message').textContent = err.message;
    errorView.style.display = 'flex';
  } finally {
    loader.remove();
  }
}

/* Mermaid Rendering Integrator */
async function renderMermaidDiagrams(container) {
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
        openMermaidModal(block.text);
      });
    } catch (err) {
      console.error('Erro de diagramação Mermaid:', err);
      // Exibe erro explicativo amigável no lugar do bloco
      block.element.innerHTML = `
        <div style="color: var(--error-red); padding: 12px; font-size: 0.8rem; font-family: var(--font-mono); border: 1px dashed var(--error-red); border-radius: 6px;">
          <strong>[Erro no Diagrama Mermaid]</strong><br>${err.message}
        </div>
      `;
      // Limpa qualquer classe que impeça renderizações futuras
      block.element.removeAttribute('style');
    }
  }
}

/* Pan & Zoom Modal Controller */
let panzoomInstance = null;

function initModal() {
  const modal = document.getElementById('mermaid-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const backdrop = document.getElementById('modal-backdrop');
  
  const zoomIn = document.getElementById('zoom-in-btn');
  const zoomOut = document.getElementById('zoom-out-btn');
  const zoomReset = document.getElementById('zoom-reset-btn');

  const closeModal = () => {
    modal.style.display = 'none';
    if (panzoomInstance) {
      panzoomInstance.destroy();
      panzoomInstance = null;
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
    if (panzoomInstance) panzoomInstance.zoomIn();
  });

  zoomOut.addEventListener('click', () => {
    if (panzoomInstance) panzoomInstance.zoomOut();
  });

  zoomReset.addEventListener('click', () => {
    if (panzoomInstance) panzoomInstance.reset();
  });
}

async function openMermaidModal(diagramText) {
  const modal = document.getElementById('mermaid-modal');
  const target = document.getElementById('modal-diagram-target');
  
  target.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span>Processando diagrama...</span>
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
    panzoomInstance = Panzoom(svgElement, {
      maxScale: 10,
      minScale: 0.1,
      contain: 'outside',
      duration: 200
    });

    // Zoom bindings with mouse wheel
    const panContainer = document.getElementById('panzoom-container');
    panContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      panzoomInstance.zoomWithWheel(e);
    });

  } catch (err) {
    console.error('Erro ao processar modal do diagrama:', err);
    target.innerHTML = `
      <div class="error-body">
        <i data-lucide="alert-octagon" class="error-icon"></i>
        <h3>Falha no Modal</h3>
        <p>Não foi possível renderizar o diagrama interativo. (${err.message})</p>
      </div>
    `;
    lucide.createIcons();
  }
}
