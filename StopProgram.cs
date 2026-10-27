using System;
using System.Diagnostics;
using System.Windows.Forms;

namespace AlHajjRefaatStopper
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            int killed = 0;
            try
            {
                foreach (var p in Process.GetProcessesByName("node"))
                {
                    try
                    {
                        p.Kill();
                        killed++;
                    }
                    catch { }
                }
            }
            catch { }

            MessageBox.Show("تم إيقاف نظام الحاج رفعت بنجاح.", "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
