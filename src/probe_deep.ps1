[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$bb = Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, Version, SerialNumber
$bios = Get-CimInstance Win32_BIOS | Select-Object Manufacturer, SMBIOSBIOSVersion, ReleaseDate
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture, LastBootUpTime
$ram = @(Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer, PartNumber, Speed, ConfiguredClockSpeed, Capacity, DeviceLocator, FormFactor)
$cpu = Get-CimInstance Win32_Processor | Select-Object Name, MaxClockSpeed, L2CacheSize, L3CacheSize, NumberOfCores, NumberOfLogicalProcessors
$gpu = @(Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, DriverDate, AdapterRAM, VideoProcessor, VideoModeDescription, CurrentRefreshRate)
$sound = @(Get-CimInstance Win32_SoundDevice | Select-Object Name, Manufacturer, Status)

[PSCustomObject]@{
    motherboard = $bb
    bios = $bios
    os = $os
    ram_sticks = $ram
    cpu_deep = $cpu
    gpus = $gpu
    audio = $sound
} | ConvertTo-Json -Depth 4 -Compress
