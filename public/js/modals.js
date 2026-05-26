export class ModalManager {
  constructor(app) {
    this.app = app;
    this._wheelHandler = null;
  }

  init() {
    this.initMermaidModal();
    this.initEditModal();
    this.initDeleteModal();
  }

  /* Pan & Zoom Modal Controller */
  initMermaidModal() {
    const modal = document.getElementById('mermaid-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const backdrop = document.getElementById('modal-backdrop');
    
    const zoomIn = document.getElementById('zoom-in-btn');
    const zoomOut = document.getElementById('zoom-out-btn');
    const zoomReset = document.getElementById('zoom-reset-btn');

    const closeModal = () => {
      modal.style.display = 'none';
      if (this.app.panzoomInstance) {
        this.app.panzoomInstance.destroy();
        this.app.panzoomInstance = null;
      }
    };

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    zoomIn.addEventListener('click', () => {
      if (this.app.panzoomInstance) this.app.panzoomInstance.zoomIn();
    });

    zoomOut.addEventListener('click', () => {
      if (this.app.panzoomInstance) this.app.panzoomInstance.zoomOut();
    });

    zoomReset.addEventListener('click', () => {
      if (this.app.panzoomInstance) this.app.panzoomInstance.reset();
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
      const { svg } = await mermaid.render('modal-svg-render', diagramText);
      target.innerHTML = svg;
      
      const svgElement = target.querySelector('svg');
      
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.style.maxWidth = 'none';
      svgElement.style.maxHeight = 'none';
      
      this.app.panzoomInstance = Panzoom(svgElement, {
        maxScale: 10,
        minScale: 0.1,
        contain: 'outside',
        duration: 200
      });

      const panContainer = document.getElementById('panzoom-container');
      if (this._wheelHandler) {
        panContainer.removeEventListener('wheel', this._wheelHandler);
      }
      this._wheelHandler = (e) => {
        e.preventDefault();
        this.app.panzoomInstance.zoomWithWheel(e);
      };
      panContainer.addEventListener('wheel', this._wheelHandler);

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
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
    
    themeSelect.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      localStorage.setItem('minio-editor-theme', newTheme);
      
      if (this.app.editEditorInstance) {
        this.app.editEditorInstance.setOption('theme', newTheme);
      }
      if (this.app.currentViewerEditor) {
        this.app.currentViewerEditor.setOption('theme', newTheme);
      }
    });

    const editBtn = document.getElementById('edit-btn');
    editBtn.addEventListener('click', async () => {
      if (!this.app.activeFileMeta) return;
      const { bucket, path, name } = this.app.activeFileMeta;
      
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
    
    if (!this.app.editEditorInstance) {
      textarea.value = content;
      this.app.editEditorInstance = CodeMirror.fromTextArea(textarea, {
        lineNumbers: true,
        lineWrapping: true,
        theme: activeTheme,
        mode: mode
      });
    } else {
      this.app.editEditorInstance.setValue(content);
      this.app.editEditorInstance.setOption('mode', mode);
      this.app.editEditorInstance.setOption('theme', activeTheme);
    }
    
    setTimeout(() => {
      this.app.editEditorInstance.refresh();
    }, 100);
    
    const saveBtn = document.getElementById('edit-save-btn');
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
    
    saveBtn.onclick = async () => {
      const updatedContent = this.app.editEditorInstance.getValue();
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
        
        await this.app.viewerManager.loadFile(bucket, path, filename, updatedContent.length, new Date().toISOString());
        
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
      this.app.nodeToDelete = null;
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });
    
    confirmBtn.addEventListener('click', async () => {
      if (!this.app.nodeToDelete) return;
      
      const path = this.app.nodeToDelete.dataset.path;
      const bucket = this.app.nodeToDelete.dataset.bucket;
      const isDir = this.app.nodeToDelete.dataset.isDir === 'true';
      
      try {
        const res = await fetch(`/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&isDir=${isDir}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) throw new Error(await res.text() || 'Failed to delete');
        
        const nodeToRefresh = this.app.nodeToDelete;
        closeModal();
        
        if (this.app.activeFileMeta && this.app.activeFileMeta.bucket === bucket && this.app.activeFileMeta.path === path) {
          this.resetViewerToWelcome();
        }
        
        await this.app.treeview.refreshParentOfNode(nodeToRefresh);
        
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    });
  }

  promptDelete(node) {
    this.app.nodeToDelete = node;
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
    this.app.activeFileMeta = null;
    document.getElementById('viewer-header').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('markdown-view').style.display = 'none';
    document.getElementById('text-view').style.display = 'none';
    document.getElementById('error-view').style.display = 'none';
    document.getElementById('edit-btn').style.display = 'none';
  }
}
