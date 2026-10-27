using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace AlHajjRefaatLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodeExe = Path.Combine(baseDir, @"runtime\node.exe");
            string indexJs = Path.Combine(baseDir, "index.js");
            string batFile = Path.Combine(baseDir, "Start-System.bat");

            // 1. If backend is already running and healthy, open browser directly!
            if (IsHealthy())
            {
                OpenBrowser();
                return;
            }

            // 2. Clear any orphaned node.exe processes
            try
            {
                foreach (var p in Process.GetProcessesByName("node"))
                {
                    try { p.Kill(); } catch { }
                }
            }
            catch { }

            // 3. Start node process in background
            Process nodeProcess = null;
            if (File.Exists(nodeExe) && File.Exists(indexJs))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "index.js";
                psi.WorkingDirectory = baseDir;
                psi.EnvironmentVariables["OPEN_BROWSER"] = "false";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                try
                {
                    nodeProcess = Process.Start(psi);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("خطأ في تشغيل محرك النظام:\n" + ex.Message, "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }
            else if (File.Exists(batFile))
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = batFile;
                psi.WorkingDirectory = baseDir;
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            else
            {
                MessageBox.Show("ملفات تشغيل النظام غير مكتملة.\nيرجى التأكد من استخراج (فك ضغط) المجلد بالكامل قبل التشغيل.", "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // 4. Poll health check every 250ms up to 60 times (15 seconds max)
            for (int i = 0; i < 60; i++)
            {
                Thread.Sleep(250);
                if (IsHealthy())
                {
                    OpenBrowser();
                    return;
                }
                if (nodeProcess != null && nodeProcess.HasExited)
                {
                    MessageBox.Show("توقف محرك النظام عن العمل.\nيمكنك تجربة تشغيل (تشغيل_النظام.bat) للتحقق من سبب التوقف.", "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            // 5. Fallback if timeout
            OpenBrowser();
        }

        static bool IsHealthy()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5000/api/health");
                req.Timeout = 800;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        static void OpenBrowser()
        {
            try
            {
                Process.Start(new ProcessStartInfo("http://127.0.0.1:5000") { UseShellExecute = true });
            }
            catch { }
        }
    }
}
