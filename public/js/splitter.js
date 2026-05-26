export class Splitter {
  constructor(app) {
    this.app = app;
  }

  init() {
    const splitter = document.getElementById('splitter');
    const sidebar = document.getElementById('sidebar');

    splitter.addEventListener('mousedown', (e) => {
      this.app.isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      splitter.classList.add('active');
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.app.isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 220 && newWidth <= 600) {
        sidebar.style.width = `${newWidth}px`;
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.app.isResizing) {
        this.app.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        splitter.classList.remove('active');
        if (this.app.currentViewerEditor) {
          this.app.currentViewerEditor.refresh();
        }
      }
    });
  }
}
