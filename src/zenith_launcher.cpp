#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <shellapi.h>
#include <string>
#include <vector>

#pragma comment(lib, "ws2_32.lib")

bool isPortListening(int port) {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return false;

    SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (sock == INVALID_SOCKET) {
        WSACleanup();
        return false;
    }

    // Set non-blocking mode
    u_long mode = 1;
    ioctlsocket(sock, FIONBIO, &mode);

    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

    connect(sock, (sockaddr*)&addr, sizeof(addr));

    fd_set writeSet;
    FD_ZERO(&writeSet);
    FD_SET(sock, &writeSet);

    timeval tv;
    tv.tv_sec = 0;
    tv.tv_usec = 80000; // 80 ms

    int sel = select(0, NULL, &writeSet, NULL, &tv);
    bool listening = (sel > 0);

    closesocket(sock);
    WSACleanup();
    return listening;
}

bool fileExists(const std::wstring& path) {
    DWORD dwAttrib = GetFileAttributesW(path.c_str());
    return (dwAttrib != INVALID_FILE_ATTRIBUTES && !(dwAttrib & FILE_ATTRIBUTE_DIRECTORY));
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // Get application directory
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::wstring appDir = exePath;
    size_t lastSlash = appDir.find_last_of(L"\\/");
    if (lastSlash != std::wstring::npos) {
        appDir = appDir.substr(0, lastSlash);
    }
    SetCurrentDirectoryW(appDir.c_str());

    // Check if server is running
    if (!isPortListening(49152)) {
        // Run probe once if cache doesn't exist
        std::wstring cachePath = appDir + L"\\hardware_cache.json";
        std::wstring probePath = appDir + L"\\bin\\zenith_probe.exe";
        if (!fileExists(cachePath) && fileExists(probePath)) {
            STARTUPINFOW si = { sizeof(si) };
            PROCESS_INFORMATION pi = { 0 };
            si.dwFlags = STARTF_USESHOWWINDOW;
            si.wShowWindow = SW_HIDE;
            if (CreateProcessW(NULL, const_cast<wchar_t*>(probePath.c_str()), NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, appDir.c_str(), &si, &pi)) {
                WaitForSingleObject(pi.hProcess, 3000);
                CloseHandle(pi.hProcess);
                CloseHandle(pi.hThread);
            }
        }

        // Start python server in background
        std::wstring serverCmd = L"python src\\zenith_server.py";
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi = { 0 };
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_HIDE;
        if (CreateProcessW(NULL, const_cast<wchar_t*>(serverCmd.c_str()), NULL, NULL, FALSE, CREATE_NO_WINDOW | DETACHED_PROCESS, NULL, appDir.c_str(), &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            Sleep(400);
        }
    }

    // Locate preferred Chromium browser
    wchar_t localAppData[MAX_PATH];
    wchar_t progFiles[MAX_PATH];
    wchar_t progFilesX86[MAX_PATH];
    GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH);
    GetEnvironmentVariableW(L"ProgramFiles", progFiles, MAX_PATH);
    GetEnvironmentVariableW(L"ProgramFiles(x86)", progFilesX86, MAX_PATH);

    std::vector<std::wstring> candidatePaths = {
        std::wstring(localAppData) + L"\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        std::wstring(progFiles) + L"\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        std::wstring(progFilesX86) + L"\\Microsoft\\Edge\\Application\\msedge.exe",
        std::wstring(progFiles) + L"\\Microsoft\\Edge\\Application\\msedge.exe",
        std::wstring(progFiles) + L"\\Google\\Chrome\\Application\\chrome.exe",
        std::wstring(localAppData) + L"\\Google\\Chrome\\Application\\chrome.exe"
    };

    std::wstring chosenBrowser = L"";
    for (const auto& path : candidatePaths) {
        if (fileExists(path)) {
            chosenBrowser = path;
            break;
        }
    }

    std::wstring appUrl = L"http://127.0.0.1:49152";
    std::wstring windowSize = L"1240,820";

    if (lpCmdLine && (strstr(lpCmdLine, "--hud") || strstr(lpCmdLine, "-hud") || strstr(lpCmdLine, "/hud"))) {
        appUrl = L"http://127.0.0.1:49152/hud.html";
        windowSize = L"340,145";
    }

    if (!chosenBrowser.empty()) {
        std::wstring fullCmd = L"\"" + chosenBrowser + L"\" --app=\"" + appUrl + L"\" --window-size=" + windowSize;
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi = { 0 };
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = SW_SHOWNORMAL;
        if (CreateProcessW(NULL, const_cast<wchar_t*>(fullCmd.c_str()), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            return 0;
        }
    }

    // Fallback to default browser
    ShellExecuteW(NULL, L"open", appUrl.c_str(), NULL, NULL, SW_SHOWNORMAL);
    return 0;
}
