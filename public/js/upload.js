export class UploadManager {
  constructor(app) {
    this.app = app;
  }

  init() {
    const globalInput = document.getElementById('global-file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const dragOverlay = document.getElementById('drag-drop-overlay');
    const uploadManager = document.getElementById('upload-manager');
    const uploadList = document.getElementById('upload-list');
    const minimizeBtn = document.getElementById('upload-minimize-btn');
    const closeBtn = document.getElementById('upload-close-btn');
    const managerHeader = document.getElementById('upload-manager-header');

    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.app.currentBucket) {
        alert('Please select a bucket or folder first by expanding or selecting a directory.');
        return;
      }
      globalInput.value = '';
      globalInput.click();
    });

    globalInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.queueFiles(e.target.files);
      }
    });

    const toggleMinimize = (e) => {
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

    closeBtn.addEventListener('click', () => {
      if (this.app.isUploading) {
        alert('Cannot close while uploads are in progress.');
        return;
      }
      uploadManager.style.display = 'none';
      uploadList.innerHTML = '';
      this.app.uploadQueue = [];
    });

    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      
      const titleEl = document.getElementById('drag-drop-title');
      const subtitleEl = document.getElementById('drag-drop-subtitle');
      const iconEl = dragOverlay.querySelector('.drag-icon');

      if (!this.app.currentBucket) {
        titleEl.textContent = 'Upload Disabled';
        subtitleEl.textContent = 'Please select a bucket or folder first';
        iconEl.setAttribute('data-lucide', 'alert-circle');
        dragOverlay.style.border = '4px dashed var(--error-red)';
        dragOverlay.style.color = 'var(--error-red)';
      } else {
        titleEl.textContent = 'Drop files to upload';
        const folderDisplay = this.app.currentFolder ? `/${this.app.currentFolder}` : '';
        subtitleEl.textContent = `Uploading to: ${this.app.currentBucket}${folderDisplay}`;
        iconEl.setAttribute('data-lucide', 'upload-cloud');
        dragOverlay.style.border = '4px dashed var(--accent-blue)';
        dragOverlay.style.color = 'var(--accent-blue)';
      }
      lucide.createIcons();
      dragOverlay.style.display = 'flex';
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = this.app.currentBucket ? 'copy' : 'none';
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

      if (!this.app.currentBucket) {
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

    uploadManager.style.display = 'flex';
    uploadManager.classList.remove('minimized');
    const minIcon = document.getElementById('upload-minimize-btn').querySelector('i');
    if (minIcon) {
      minIcon.setAttribute('data-lucide', 'minus');
    }

    Array.from(fileList).forEach(file => {
      const item = {
        id: 'upload-' + Math.random().toString(36).substring(2, 9),
        file: file,
        name: file.name,
        size: file.size,
        bucket: this.app.currentBucket,
        folder: this.app.currentFolder,
        progress: 0,
        status: 'pending'
      };

      this.app.uploadQueue.push(item);
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
    if (this.app.isUploading) return;

    const item = this.app.uploadQueue.find(x => x.status === 'pending');

    const managerIconContainer = document.getElementById('upload-manager-icon-container');
    const managerText = document.getElementById('upload-manager-text');

    if (!item) {
      this.app.isUploading = false;
      
      const totalCount = this.app.uploadQueue.length;
      const errorCount = this.app.uploadQueue.filter(x => x.status === 'error').length;
      
      if (errorCount === 0) {
        managerText.textContent = `All ${totalCount} uploads completed!`;
        if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="check" class="spinner-icon success"></i>';
      } else {
        managerText.textContent = `Completed with ${errorCount} errors`;
        if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="alert-triangle" class="spinner-icon error"></i>';
      }
      lucide.createIcons();

      const foldersToRefresh = new Set();
      this.app.uploadQueue.forEach(q => {
        if (q.status === 'success') {
          foldersToRefresh.add(JSON.stringify({ bucket: q.bucket, folder: q.folder }));
        }
      });

      for (const fJson of foldersToRefresh) {
        const { bucket, folder } = JSON.parse(fJson);
        const folderNode = this.app.treeview.findFolderNode(bucket, folder);
        if (folderNode) {
          await this.app.treeview.refreshFolder(folderNode);
        } else {
          await this.app.treeview.loadRootNodes();
        }
      }
      return;
    }

    this.app.isUploading = true;
    item.status = 'uploading';
    this.updateUploadItemUI(item);

    const totalCount = this.app.uploadQueue.length;
    const currentIndex = this.app.uploadQueue.indexOf(item) + 1;
    managerText.textContent = `Uploading file ${currentIndex} of ${totalCount}...`;
    if (managerIconContainer) managerIconContainer.innerHTML = '<i data-lucide="loader" class="spinner-icon" style="animation: spin 1s linear infinite;"></i>';
    lucide.createIcons();

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('bucket', item.bucket);
    
    const destinationPath = item.folder ? `${item.folder}${item.name}` : item.name;
    formData.append('path', destinationPath);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        item.progress = Math.min(percent, 99);
        this.updateUploadItemUI(item);
      }
    });

    xhr.addEventListener('load', () => {
      this.app.isUploading = false;
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
      this.app.isUploading = false;
      item.status = 'error';
      item.error = 'Network connection failed';
      item.progress = 100;
      this.updateUploadItemUI(item);
      this.processUploadQueue();
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }
}
