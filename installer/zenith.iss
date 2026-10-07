; Zenith System - Inno Setup script. Built by build_setup.ps1 (SourceDir is passed as /DStage=...).
#define AppName "Zenith System"
#define AppVer  "1.0.0"
[Setup]
AppId={{6F1B2D54-7A3E-4C1B-9E0A-5A2D1C0E7B11}
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher=ahmetselmancloud
AppPublisherURL=https://github.com/ahmetselmancloud/zenith-system
DefaultDirName={localappdata}\ZenithSystem
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
DisableDirPage=yes
OutputDir={#OutDir}
OutputBaseFilename=Zenith-Setup-v1.0.0-x64
SetupIconFile={#Stage}\assets\zenith.ico
UninstallDisplayIcon={app}\Zenith.exe
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
CloseApplications=force
[Files]
Source: "{#Stage}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
[Icons]
Name: "{autoprograms}\Zenith System"; Filename: "{app}\Zenith.exe"; WorkingDir: "{app}"
Name: "{autoprograms}\Zenith Mini HUD"; Filename: "{app}\Zenith.exe"; Parameters: "--hud"; WorkingDir: "{app}"
Name: "{autodesktop}\Zenith System"; Filename: "{app}\Zenith.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Zenith Mini HUD"; Filename: "{app}\Zenith.exe"; Parameters: "--hud"; WorkingDir: "{app}"
[Run]
Filename: "{app}\Zenith.exe"; Description: "Launch Zenith System"; Flags: nowait postinstall skipifsilent
