using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace manager;

public partial class Form1 : Form
{
    private Button? btnToggle;
    private Label? lblStatus;
    private LinkLabel? lnkUrl;
    private Panel? pnlStatusDot;
    private NotifyIcon? notifyIcon;
    private ContextMenuStrip? trayMenu;
    private ToolStripMenuItem? menuToggle;
    private ToolStripMenuItem? menuRestore;
    private ToolStripMenuItem? menuExit;
    private ToolStripMenuItem? menuOpenUrl;

    private Process? _nodeProcess;
    private string _projectRoot = string.Empty;
    private int _port = 4000;

    // Master custom icons (disposed at form close). Clones are assigned to Form/NotifyIcon
    // because WinForms takes ownership of the Icon instance passed to those properties.
    private Icon? _iconStopped;
    private Icon? _iconRunning;

    public Form1()
    {
        InitializeComponentProgrammatic();
        LoadConfig();
        UpdateUIState();
        StartNodeProcess();
        UpdateUIState();
    }

    private void InitializeComponentProgrammatic()
    {
        this.components = new System.ComponentModel.Container();
        
        // Form styling
        this.Text = "MinIO Navigator Manager";
        this.Size = new Size(360, 220);
        this.FormBorderStyle = FormBorderStyle.FixedSingle;
        this.MaximizeBox = false; // Hide the maximize button
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(245, 246, 248);

        // Start minimized to system tray by default
        this.WindowState = FormWindowState.Minimized;
        this.ShowInTaskbar = false;

        // Load Custom Icons (Stopped = red, Running = green)
        string managerDir = Path.Combine(GetProjectRoot(), "manager");
        _iconStopped = TryLoadIcon(Path.Combine(managerDir, "icon.ico"));
        _iconRunning = TryLoadIcon(Path.Combine(managerDir, "icon-running.ico"));

        // Apply initial icon (stopped / red)
        ApplyIcon(_iconStopped);

        // Status Panel (Dot + Text)
        pnlStatusDot = new Panel();
        pnlStatusDot.Size = new Size(12, 12);
        pnlStatusDot.Location = new Point(25, 27);
        pnlStatusDot.BackColor = Color.Gray;
        // Make panel a circle
        using (System.Drawing.Drawing2D.GraphicsPath gp = new System.Drawing.Drawing2D.GraphicsPath())
        {
            gp.AddEllipse(0, 0, pnlStatusDot.Width, pnlStatusDot.Height);
            pnlStatusDot.Region = new Region(gp);
        }

        lblStatus = new Label();
        lblStatus.Text = "Status: Parado";
        lblStatus.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        lblStatus.ForeColor = Color.FromArgb(70, 80, 95);
        lblStatus.Location = new Point(45, 23);
        lblStatus.AutoSize = true;

        // Big Toggle Button
        btnToggle = new Button();
        btnToggle.Text = "Iniciar MinIO Navigator";
        btnToggle.Font = new Font("Segoe UI", 11F, FontStyle.Bold);
        btnToggle.Size = new Size(294, 50);
        btnToggle.Location = new Point(25, 55);
        btnToggle.FlatStyle = FlatStyle.Flat;
        btnToggle.FlatAppearance.BorderSize = 0;
        btnToggle.Cursor = Cursors.Hand;
        btnToggle.Click += BtnToggle_Click;

        // Clickable URL
        lnkUrl = new LinkLabel();
        lnkUrl.Text = "http://localhost:4000";
        lnkUrl.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
        lnkUrl.Location = new Point(25, 115);
        lnkUrl.Size = new Size(294, 25);
        lnkUrl.TextAlign = ContentAlignment.TopCenter;
        lnkUrl.LinkClicked += LnkUrl_LinkClicked;
        lnkUrl.Visible = false; // Only visible when running

        // Notify Icon (System Tray)
        notifyIcon = new NotifyIcon(this.components);
        ApplyIcon(_iconStopped);
        notifyIcon.Text = "MinIO Navigator Manager";
        notifyIcon.DoubleClick += NotifyIcon_DoubleClick;
        notifyIcon.Click += NotifyIcon_Click;


        // Context Menu for System Tray
        trayMenu = new ContextMenuStrip();
        menuRestore = new ToolStripMenuItem("Restaurar", null, NotifyIcon_DoubleClick);
        menuOpenUrl = new ToolStripMenuItem($"Abrir http://localhost:{_port}", null, MenuOpenUrl_Click);
        menuToggle = new ToolStripMenuItem("Iniciar", null, BtnToggle_Click);
        menuExit = new ToolStripMenuItem("Sair", null, MenuExit_Click);

        trayMenu.Items.Add(menuRestore);
        trayMenu.Items.Add(menuOpenUrl);
        trayMenu.Items.Add(menuToggle);
        trayMenu.Items.Add(new ToolStripSeparator());
        trayMenu.Items.Add(menuExit);
        notifyIcon.ContextMenuStrip = trayMenu;

        // Add controls to form
        this.Controls.Add(pnlStatusDot);
        this.Controls.Add(lblStatus);
        this.Controls.Add(btnToggle);
        this.Controls.Add(lnkUrl);
    }

    private static Icon? TryLoadIcon(string path)
    {
        if (!File.Exists(path)) return null;
        try
        {
            return new Icon(path);
        }
        catch
        {
            return null;
        }
    }

    private void ApplyIcon(Icon? source)
    {
        // Clone because WinForms takes ownership of the Icon instance assigned to
        // Form.Icon / NotifyIcon.Icon. Sharing a master would cause ObjectDisposedException
        // when one of the controls disposes of it.
        Icon newIcon = source != null ? (Icon)source.Clone() : (Icon)SystemIcons.Application.Clone();

        // Form icon (title bar + taskbar)
        Icon? oldFormIcon = this.Icon;
        this.Icon = newIcon;
        if (oldFormIcon != null && oldFormIcon != SystemIcons.Application)
        {
            oldFormIcon.Dispose();
        }

        // NotifyIcon (system tray)
        if (notifyIcon != null)
        {
            Icon? oldTrayIcon = notifyIcon.Icon;
            notifyIcon.Icon = newIcon;
            if (oldTrayIcon != null && oldTrayIcon != SystemIcons.Application)
            {
                oldTrayIcon.Dispose();
            }
        }
    }

    private void LoadConfig()
    {
        _projectRoot = GetProjectRoot();
        string envPath = Path.Combine(_projectRoot, ".env");
        if (File.Exists(envPath))
        {
            try
            {
                var lines = File.ReadAllLines(envPath);
                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line) || line.Trim().StartsWith("#"))
                        continue;

                    var parts = line.Split('=', 2);
                    if (parts.Length == 2 && parts[0].Trim() == "PORT")
                    {
                        if (int.TryParse(parts[1].Trim(), out int parsedPort))
                        {
                            _port = parsedPort;
                        }
                    }
                }
            }
            catch
            {
                // Fallback to default
            }
        }
        if (lnkUrl != null)
        {
            lnkUrl.Text = $"http://localhost:{_port}";
        }
        if (menuOpenUrl != null)
        {
            menuOpenUrl.Text = $"Abrir http://localhost:{_port}";
        }
    }

    private string GetProjectRoot()
    {
        string currentDir = AppDomain.CurrentDomain.BaseDirectory;
        while (!string.IsNullOrEmpty(currentDir))
        {
            if (File.Exists(Path.Combine(currentDir, "server.js")) && File.Exists(Path.Combine(currentDir, "package.json")))
            {
                return currentDir;
            }
            string? parent = Directory.GetParent(currentDir)?.FullName;
            if (string.IsNullOrEmpty(parent) || parent == currentDir) break;
            currentDir = parent;
        }
        return @"D:\MyProjs_Temp\minIONavigator";
    }

    private void UpdateUIState()
    {
        bool isRunning = _nodeProcess != null && !_nodeProcess.HasExited;

        if (isRunning)
        {
            if (lblStatus != null)
            {
                lblStatus.Text = "Status: Executando";
                lblStatus.ForeColor = Color.FromArgb(39, 174, 96); // Nice green
            }
            if (pnlStatusDot != null)
            {
                pnlStatusDot.BackColor = Color.FromArgb(39, 174, 96);
            }
            if (btnToggle != null)
            {
                btnToggle.Text = "Parar MinIO Navigator";
                btnToggle.BackColor = Color.FromArgb(231, 76, 60); // Nice tomato red
                btnToggle.ForeColor = Color.White;
            }
            if (lnkUrl != null)
            {
                lnkUrl.Visible = true;
            }
            if (menuToggle != null)
            {
                menuToggle.Text = "Parar";
            }
            if (menuOpenUrl != null)
            {
                menuOpenUrl.Enabled = true;
            }
            ApplyIcon(_iconRunning);
        }
        else
        {
            if (lblStatus != null)
            {
                lblStatus.Text = "Status: Parado";
                lblStatus.ForeColor = Color.FromArgb(127, 140, 141); // Slate gray
            }
            if (pnlStatusDot != null)
            {
                pnlStatusDot.BackColor = Color.FromArgb(127, 140, 141);
            }
            if (btnToggle != null)
            {
                btnToggle.Text = "Iniciar MinIO Navigator";
                btnToggle.BackColor = Color.FromArgb(52, 152, 219); // Modern flat blue
                btnToggle.ForeColor = Color.White;
            }
            if (lnkUrl != null)
            {
                lnkUrl.Visible = false;
            }
            if (menuToggle != null)
            {
                menuToggle.Text = "Iniciar";
            }
            if (menuOpenUrl != null)
            {
                menuOpenUrl.Enabled = false;
            }
            ApplyIcon(_iconStopped);
        }
    }

    private void BtnToggle_Click(object? sender, EventArgs e)
    {
        bool isRunning = _nodeProcess != null && !_nodeProcess.HasExited;

        if (isRunning)
        {
            StopNodeProcess();
        }
        else
        {
            StartNodeProcess();
        }
        UpdateUIState();
    }

    private void StartNodeProcess()
    {
        try
        {
            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = "node.exe",
                Arguments = "server.js",
                WorkingDirectory = _projectRoot,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            _nodeProcess = new Process();
            _nodeProcess.StartInfo = startInfo;
            _nodeProcess.EnableRaisingEvents = true;
            _nodeProcess.Exited += NodeProcess_Exited;

            _nodeProcess.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Erro ao iniciar o MinIO Navigator: {ex.Message}", "Erro de Inicialização", MessageBoxButtons.OK, MessageBoxIcon.Error);
            _nodeProcess = null;
        }
    }

    private void StopNodeProcess()
    {
        if (_nodeProcess != null)
        {
            try
            {
                if (!_nodeProcess.HasExited)
                {
                    _nodeProcess.Kill(true); // Kills the entire process tree
                }
            }
            catch
            {
                // Ignore any error on killing
            }
            finally
            {
                _nodeProcess.Dispose();
                _nodeProcess = null;
            }
        }
    }

    private void NodeProcess_Exited(object? sender, EventArgs e)
    {
        // Safe cross-thread invoke to update UI when process exits unexpectedly
        if (this.InvokeRequired)
        {
            this.BeginInvoke(new Action(() => {
                _nodeProcess = null;
                UpdateUIState();
            }));
        }
        else
        {
            _nodeProcess = null;
            UpdateUIState();
        }
    }

    private void OpenBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = $"http://localhost:{_port}",
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Erro ao abrir o navegador: {ex.Message}", "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void LnkUrl_LinkClicked(object? sender, LinkLabelLinkClickedEventArgs e)
    {
        OpenBrowser();
    }

    private void MenuOpenUrl_Click(object? sender, EventArgs e)
    {
        OpenBrowser();
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (WindowState == FormWindowState.Minimized)
        {
            this.Hide();
            this.ShowInTaskbar = false;
            if (notifyIcon != null)
            {
                notifyIcon.Visible = true;
            }
        }
    }

    private void NotifyIcon_DoubleClick(object? sender, EventArgs e)
    {
        NotifyIcon_Click(sender, e);
    }

    private void NotifyIcon_Click(object? sender, EventArgs e)
    {
        // identificar butão direito do mouse para não restaurar a janela
        if (e is MouseEventArgs me && me.Button == MouseButtons.Right)        
            return;
            
        this.Show();
        this.WindowState = FormWindowState.Normal;
        this.ShowInTaskbar = true;
        this.Activate();
    }

    private void MenuExit_Click(object? sender, EventArgs e)
    {
        Application.Exit();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        StopNodeProcess();
        if (notifyIcon != null)
        {
            notifyIcon.Visible = false;
            notifyIcon.Dispose();
        }
        _iconStopped?.Dispose();
        _iconRunning?.Dispose();
        base.OnFormClosing(e);
    }
}
