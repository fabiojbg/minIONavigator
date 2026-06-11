using System;
using System.Threading;
using System.Windows.Forms;

namespace manager;

static class Program
{
    private const string MutexName = "Global\\MinIONavigatorManager_SingleInstance";
    private const string ShowEventName = "Global\\MinIONavigatorManager_ShowEvent";

    private static Mutex? _instanceMutex;
    private static EventWaitHandle? _showEvent;
    private static Form1? _mainForm;

    /// <summary>
    ///  The main entry point for the application.
    /// </summary>
    [STAThread]
    static void Main()
    {
        // Single-instance guard: try to acquire the named mutex.
        _instanceMutex = new Mutex(initiallyOwned: true, name: MutexName, out bool createdNew);
        if (!createdNew)
        {
            // Another instance is already running. Tell it to show itself, then exit quietly.
            try
            {
                EventWaitHandle.OpenExisting(ShowEventName).Set();
            }
            catch
            {
                // Best-effort signaling; if the event handle is unavailable we just exit.
            }
            return;
        }

        // Create the show event so other instances can signal us.
        _showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName);

        ApplicationConfiguration.Initialize();
        _mainForm = new Form1();

        // Background thread that listens for "show" requests from secondary instances.
        var listener = new Thread(() =>
        {
            while (_mainForm != null && !_mainForm.IsDisposed)
            {
                try
                {
                    _showEvent?.WaitOne();
                }
                catch
                {
                    break;
                }

                if (_mainForm == null || _mainForm.IsDisposed) break;

                try
                {
                    _mainForm.Invoke((Action)BringMainFormToFront);
                }
                catch
                {
                    // Form is being closed concurrently; ignore.
                }
            }
        })
        {
            IsBackground = true,
            Name = "SingleInstanceListener"
        };
        listener.Start();

        try
        {
            Application.Run(_mainForm);
        }
        finally
        {
            _showEvent?.Dispose();
            _instanceMutex?.ReleaseMutex();
            _instanceMutex?.Dispose();
        }
    }

    private static void BringMainFormToFront()
    {
        if (_mainForm == null || _mainForm.IsDisposed) return;
        if (_mainForm.WindowState == FormWindowState.Minimized)
        {
            _mainForm.WindowState = FormWindowState.Normal;
        }
        _mainForm.ShowInTaskbar = true;
        _mainForm.Show();
        _mainForm.Activate();
        _mainForm.BringToFront();
    }
}
