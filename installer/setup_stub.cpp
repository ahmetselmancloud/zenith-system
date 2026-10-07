// Zenith System - single-file offline installer stub.
// Embeds the release zip + setup_zenith.ps1 as resources, unpacks them to %TEMP% and runs the script.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>

static bool dumpResource(int id, const std::wstring& path) {
    HRSRC r = FindResourceW(NULL, MAKEINTRESOURCEW(id), MAKEINTRESOURCEW(10));
    if (!r) return false;
    HGLOBAL g = LoadResource(NULL, r);
    void* p = LockResource(g);
    DWORD sz = SizeofResource(NULL, r);
    HANDLE h = CreateFileW(path.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return false;
    DWORD w = 0; bool ok = true; const char* b = (const char*)p;
    while (sz > 0 && ok) { DWORD n = sz > (1u << 24) ? (1u << 24) : sz; ok = WriteFile(h, b, n, &w, NULL) && w == n; b += n; sz -= n; }
    CloseHandle(h);
    return ok;
}

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    wchar_t tmp[MAX_PATH];
    GetTempPathW(MAX_PATH, tmp);
    std::wstring dir = std::wstring(tmp) + L"zenith-setup-" + std::to_wstring(GetCurrentProcessId());
    CreateDirectoryW(dir.c_str(), NULL);
    std::wstring zip = dir + L"\\payload.zip", ps1 = dir + L"\\setup_zenith.ps1";
    if (!dumpResource(1, zip) || !dumpResource(2, ps1)) {
        MessageBoxW(NULL, L"Setup could not unpack its files (disk full or access denied).", L"Zenith Setup", MB_ICONERROR);
        return 1;
    }
    std::wstring cmd = L"powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + ps1 + L"\" -PayloadZip \"" + zip + L"\"";
    STARTUPINFOW si = { sizeof(si) }; si.dwFlags = STARTF_USESHOWWINDOW; si.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION pi = {};
    DWORD rc = 1;
    if (CreateProcessW(NULL, &cmd[0], NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        WaitForSingleObject(pi.hProcess, INFINITE);
        GetExitCodeProcess(pi.hProcess, &rc);
        CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
    } else {
        MessageBoxW(NULL, L"Windows PowerShell could not be started.", L"Zenith Setup", MB_ICONERROR);
    }
    DeleteFileW(zip.c_str()); DeleteFileW(ps1.c_str()); RemoveDirectoryW(dir.c_str());
    return (int)rc;
}
