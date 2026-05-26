export class Treeview {
  constructor(app) {
    this.app = app;
  }

  async init() {
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
      this.app.currentFolder = '';
      
      if (items.length === 0) {
        treeContainer.innerHTML = `<div class="loading-spinner"><span>No buckets or files found.</span></div>`;
        bucketNameSpan.textContent = 'No buckets';
        return;
      }

      const firstItem = items[0];
      if (firstItem.isBucket) {
        bucketNameSpan.textContent = 'All Buckets';
        this.app.currentBucket = '';
      } else {
        this.app.currentBucket = firstItem.bucket;
        bucketNameSpan.textContent = this.app.currentBucket;
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

    if (depth > 0) {
      const indent = document.createElement('div');
      indent.className = 'tree-node-indent';
      indent.style.width = `${depth * 16}px`;
      node.appendChild(indent);
    }

    const arrow = document.createElement('span');
    arrow.className = 'node-arrow';
    if (item.isDir) {
      arrow.innerHTML = '<i data-lucide="chevron-right"></i>';
    }
    node.appendChild(arrow);

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

    const label = document.createElement('span');
    label.className = 'node-label';
    label.textContent = item.name;
    node.appendChild(label);

    if (!item.isBucket) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'node-actions';

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
              this.app.modalManager.openEditModal(item.bucket, item.path, item.name, content);
            } catch (err) {
              alert(err.message);
            }
          });
          actionsContainer.appendChild(editAction);
        }
      }

      const deleteAction = document.createElement('button');
      deleteAction.className = 'node-action-btn delete';
      deleteAction.title = 'Delete';
      deleteAction.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteAction.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.modalManager.promptDelete(node);
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

      node.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
        node.classList.add('active');
        this.app.currentFolder = node.dataset.path || '';
        this.app.currentBucket = node.dataset.bucket || '';
      });

      node.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.toggleFolder(node, childrenDiv);
      });

      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolder(node, childrenDiv);
      });
    } else {
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        
        document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
        node.classList.add('active');

        const lastSlash = item.path.lastIndexOf('/');
        this.app.currentFolder = lastSlash !== -1 ? item.path.substring(0, lastSlash + 1) : '';
        this.app.currentBucket = item.bucket || '';

        this.app.viewerManager.loadFile(item.bucket, item.path, item.name, item.size, item.lastModified);
      });
    }

    return wrapper;
  }

  async toggleFolder(node, childrenDiv) {
    const arrow = node.querySelector('.node-arrow');
    const isExpanded = childrenDiv.style.display === 'block';

    if (isExpanded) {
      childrenDiv.style.display = 'none';
      if (arrow) {
        arrow.classList.remove('expanded');
      }
    } else {
      if (childrenDiv.dataset.loaded !== 'true') {
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

      childrenDiv.style.display = 'block';
      if (arrow) {
        arrow.classList.add('expanded');
      }
    }
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

  findFolderNode(bucket, path) {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    if (!normalizedPath) {
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
}
