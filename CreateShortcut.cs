using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Windows.Forms;

namespace AlHajjRefaatShortcut
{
    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    internal class ShellLink { }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("000214F9-0000-0000-C000-000000000046")]
    internal interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, out IntPtr pfd, int fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxPath);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
        void Resolve(IntPtr hwnd, int fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string targetExe = Path.Combine(baseDir, "Start-AlHajjRefaat.exe");
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);

                CreateLink(Path.Combine(desktop, "نظام الحاج رفعت.lnk"), targetExe, baseDir, "نظام الحاج رفعت لإدارة الحسابات");
                CreateLink(Path.Combine(desktop, "Alhaj-Refaat-System.lnk"), targetExe, baseDir, "نظام الحاج رفعت لإدارة الحسابات");

                if (args.Length == 0 || args[0] != "--silent")
                {
                    MessageBox.Show("تم إنشاء اختصار نظام الحاج رفعت على سطح المكتب بنجاح!", "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                if (args.Length == 0 || args[0] != "--silent")
                {
                    MessageBox.Show("حدث خطأ أثناء إنشاء الاختصار:\n" + ex.Message, "نظام الحاج رفعت", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        static void CreateLink(string shortcutPath, string targetPath, string workingDir, string description)
        {
            IShellLinkW link = (IShellLinkW)new ShellLink();
            link.SetPath(targetPath);
            link.SetWorkingDirectory(workingDir);
            link.SetDescription(description);
            link.SetIconLocation(targetPath, 0);

            IPersistFile file = (IPersistFile)link;
            file.Save(shortcutPath, true);
        }
    }
}
