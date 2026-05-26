import { Splitter } from './js/splitter.js';
import { Treeview } from './js/treeview.js';
import { ViewerManager } from './js/viewers.js';
import { ModalManager } from './js/modals.js';
import { UploadManager } from './js/upload.js';

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

    // Sub-components / modules
    this.splitter = new Splitter(this);
    this.treeview = new Treeview(this);
    this.viewerManager = new ViewerManager(this);
    this.modalManager = new ModalManager(this);
    this.uploadManager = new UploadManager(this);
  }

  // Initial setup
  init() {
    this.splitter.init();
    this.treeview.init();
    this.modalManager.init();
    this.uploadManager.init();
    lucide.createIcons();
  }
}

// Instantiate and initialize the app
const app = new MinIONavigator();
app.init();
