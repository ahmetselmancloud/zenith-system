#include <windows.h>
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <fstream>
#include <cstdio>
#include <cstdint>
#include <chrono>
#include <batclass.h>
#include <setupapi.h>
#include <winioctl.h>
#include <intrin.h>

// Zenith System - Hardware Intelligence Probe (C++ Native Core)
// High-performance, zero-WMI, sub-50ms hardware sensor queries

static const GUID GUID_DEVCLASS_BATTERY_LOCAL = 
    { 0x72631e54, 0x78a4, 0x11d0, { 0xbc, 0xf7, 0x00, 0xaa, 0x00, 0xb7, 0xb3, 0x2a } };

struct BatteryInfo {
    bool hasBattery = false;
    std::string deviceName = "";
    std::string chemistry = "";
    uint64_t designCapacityMWh = 0;
    uint64_t fullChargeCapacityMWh = 0;
    double healthPercentage = 0.0;
    uint64_t cycleCount = 0;
    bool isCharging = false;
    bool isDischarging = false;
    int64_t rateMilliwatts = 0;
    uint64_t remainingCapacityMWh = 0;
    double chargePercentage = 0.0;
    uint64_t voltageMillivolts = 0;
};

struct CpuInfo {
    std::string modelName = "";
    int totalCores = 0;
    int totalThreads = 0;
    int pCores = 0;
    int eCores = 0;
};

struct MemoryInfo {
    unsigned long long totalPhysicalBytes = 0;
    unsigned long long availablePhysicalBytes = 0;
    unsigned long long usedPhysicalBytes = 0;
    double usagePercentage = 0.0;
};

struct GpuInfo {
    std::string adapterName = "";
    std::string displayDevice = "";
    int currentWidth = 0;
    int currentHeight = 0;
    int refreshRateHz = 0;
    int bitsPerPixel = 0;
};

struct DiskInfo {
    int driveIndex = 0;
    std::string model = "";
    std::string busType = "";
    unsigned long long sizeBytes = 0;
};

struct NpuInfo {
    bool detected = false;
    std::string name = "";
    std::string status = "";
};

static std::string escape_json(const std::string& s) {
    std::string o;
    o.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\b': o += "\\b"; break;
            case '\f': o += "\\f"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", (unsigned char)c);
                    o += buf;
                } else {
                    o += c;
                }
                break;
        }
    }
    return o;
}


// --- BATTERY PROBE ---
BatteryInfo probeBattery() {
    BatteryInfo info;
    HDEVINFO hdev = SetupDiGetClassDevs(&GUID_DEVCLASS_BATTERY_LOCAL, 0, 0, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
    if (hdev == INVALID_HANDLE_VALUE) return info;

    SP_DEVICE_INTERFACE_DATA did = { sizeof(SP_DEVICE_INTERFACE_DATA) };
    if (SetupDiEnumDeviceInterfaces(hdev, 0, &GUID_DEVCLASS_BATTERY_LOCAL, 0, &did)) {
        DWORD cbRequired = 0;
        SetupDiGetDeviceInterfaceDetail(hdev, &did, 0, 0, &cbRequired, 0);
        if (cbRequired > 0) {
            std::vector<BYTE> detailBuf(cbRequired);
            PSP_DEVICE_INTERFACE_DETAIL_DATA pdid = (PSP_DEVICE_INTERFACE_DETAIL_DATA)detailBuf.data();
            pdid->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA);
            if (SetupDiGetDeviceInterfaceDetail(hdev, &did, pdid, cbRequired, &cbRequired, 0)) {
                HANDLE hBattery = CreateFile(pdid->DevicePath, GENERIC_READ | GENERIC_WRITE,
                    FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
                if (hBattery != INVALID_HANDLE_VALUE) {
                    BATTERY_QUERY_INFORMATION bqi = { 0 };
                    DWORD dwWait = 0;
                    DWORD dwOut;

                    if (DeviceIoControl(hBattery, IOCTL_BATTERY_QUERY_TAG, &dwWait, sizeof(dwWait),
                        &bqi.BatteryTag, sizeof(bqi.BatteryTag), &dwOut, NULL) && bqi.BatteryTag) {

                        // Query BatteryInformation
                        bqi.InformationLevel = BatteryInformation;
                        BATTERY_INFORMATION bi = { 0 };
                        if (DeviceIoControl(hBattery, IOCTL_BATTERY_QUERY_INFORMATION, &bqi, sizeof(bqi),
                            &bi, sizeof(bi), &dwOut, NULL)) {
                            info.hasBattery = true;
                            info.designCapacityMWh = bi.DesignedCapacity;
                            info.cycleCount = bi.CycleCount;
                            char chem[5] = { 0 };
                            memcpy(chem, bi.Chemistry, 4);
                            info.chemistry = chem;
                        }

                        // Query Device Name
                        bqi.InformationLevel = BatteryDeviceName;
                        wchar_t nameBuf[128] = { 0 };
                        if (DeviceIoControl(hBattery, IOCTL_BATTERY_QUERY_INFORMATION, &bqi, sizeof(bqi),
                            nameBuf, sizeof(nameBuf), &dwOut, NULL)) {
                            char strBuf[128];
                            WideCharToMultiByte(CP_UTF8, 0, nameBuf, -1, strBuf, 128, NULL, NULL);
                            info.deviceName = strBuf;
                        }

                        // Query Battery Status
                        BATTERY_WAIT_STATUS bws = { 0 };
                        bws.BatteryTag = bqi.BatteryTag;
                        BATTERY_STATUS bs = { 0 };
                        if (DeviceIoControl(hBattery, IOCTL_BATTERY_QUERY_STATUS, &bws, sizeof(bws),
                            &bs, sizeof(bs), &dwOut, NULL)) {
                            info.isCharging = (bs.PowerState & BATTERY_CHARGING) != 0;
                            info.isDischarging = (bs.PowerState & BATTERY_DISCHARGING) != 0;
                            info.rateMilliwatts = (long)bs.Rate;
                            info.remainingCapacityMWh = bs.Capacity;
                            info.voltageMillivolts = bs.Voltage;
                        }
                    }
                    CloseHandle(hBattery);
                }
            }
        }
    }
    SetupDiDestroyDeviceInfoList(hdev);
    return info;
}

// --- CPU PROBE ---
CpuInfo probeCpu() {
    CpuInfo info;
    
    // CPU Brand String via CPUID
    int cpuInfo[4] = { -1 };
    char brand[0x40] = { 0 };
    __cpuid(cpuInfo, 0x80000000);
    unsigned int nExIds = cpuInfo[0];
    if (nExIds >= 0x80000004) {
        __cpuid(reinterpret_cast<int*>(brand), 0x80000002);
        __cpuid(reinterpret_cast<int*>(brand + 16), 0x80000003);
        __cpuid(reinterpret_cast<int*>(brand + 32), 0x80000004);
        info.modelName = brand;
        size_t first = info.modelName.find_first_not_of(' ');
        if (first != std::string::npos) info.modelName = info.modelName.substr(first);
    }

    // Hybrid Core Detection
    DWORD len = 0;
    GetLogicalProcessorInformationEx(RelationProcessorCore, NULL, &len);
    if (len > 0) {
        std::vector<BYTE> buf(len);
        PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX infoEx = (PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX)buf.data();
        if (GetLogicalProcessorInformationEx(RelationProcessorCore, infoEx, &len)) {
            BYTE maxEff = 0;
            BYTE minEff = 255;
            BYTE* ptr = buf.data();
            while (ptr < buf.data() + len) {
                PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX cur = (PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX)ptr;
                if (cur->Relationship == RelationProcessorCore) {
                    if (cur->Processor.EfficiencyClass > maxEff) maxEff = cur->Processor.EfficiencyClass;
                    if (cur->Processor.EfficiencyClass < minEff) minEff = cur->Processor.EfficiencyClass;
                }
                ptr += cur->Size;
            }
            bool isHybrid = (maxEff > minEff);

            ptr = buf.data();
            while (ptr < buf.data() + len) {
                PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX cur = (PSYSTEM_LOGICAL_PROCESSOR_INFORMATION_EX)ptr;
                if (cur->Relationship == RelationProcessorCore) {
                    info.totalCores++;
                    if (cur->Processor.Flags & LTP_PC_SMT) {
                        info.totalThreads += 2;
                    } else {
                        info.totalThreads += 1;
                    }
                    if (isHybrid) {
                        if (cur->Processor.EfficiencyClass == maxEff) {
                            info.pCores++;
                        } else {
                            info.eCores++;
                        }
                    } else {
                        info.pCores++;
                    }
                }
                ptr += cur->Size;
            }
        }
    }
    return info;
}

// --- MEMORY PROBE ---
MemoryInfo probeMemory() {
    MemoryInfo info;
    MEMORYSTATUSEX memStatus;
    memStatus.dwLength = sizeof(memStatus);
    if (GlobalMemoryStatusEx(&memStatus)) {
        info.totalPhysicalBytes = memStatus.ullTotalPhys;
        info.availablePhysicalBytes = memStatus.ullAvailPhys;
        info.usedPhysicalBytes = info.totalPhysicalBytes - info.availablePhysicalBytes;
        info.usagePercentage = (double)memStatus.dwMemoryLoad;
    }
    return info;
}

// --- GPU & DISPLAY PROBE ---
std::vector<GpuInfo> probeGpus() {
    std::vector<GpuInfo> gpus;
    DISPLAY_DEVICEA dd = { sizeof(DISPLAY_DEVICEA) };
    DWORD devNum = 0;

    while (EnumDisplayDevicesA(NULL, devNum, &dd, 0)) {
        if (dd.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) {
            GpuInfo gpu;
            gpu.adapterName = dd.DeviceString;
            gpu.displayDevice = dd.DeviceName;

            DEVMODEA dm = { sizeof(DEVMODEA) };
            if (EnumDisplaySettingsA(dd.DeviceName, ENUM_CURRENT_SETTINGS, &dm)) {
                gpu.currentWidth = dm.dmPelsWidth;
                gpu.currentHeight = dm.dmPelsHeight;
                gpu.refreshRateHz = dm.dmDisplayFrequency;
                gpu.bitsPerPixel = dm.dmBitsPerPel;
            }
            gpus.push_back(gpu);
        }
        devNum++;
    }
    return gpus;
}

// --- NPU PROBE ---
NpuInfo probeNpu() {
    NpuInfo info;
    HDEVINFO hdev = SetupDiGetClassDevsA(NULL, NULL, NULL, DIGCF_ALLCLASSES | DIGCF_PRESENT);
    if (hdev == INVALID_HANDLE_VALUE) return info;

    SP_DEVINFO_DATA did = { sizeof(SP_DEVINFO_DATA) };
    DWORD idx = 0;
    while (SetupDiEnumDeviceInfo(hdev, idx, &did)) {
        char nameBuf[256] = { 0 };
        bool gotName = SetupDiGetDeviceRegistryPropertyA(hdev, &did, SPDRP_FRIENDLYNAME, NULL, (PBYTE)nameBuf, sizeof(nameBuf), NULL);
        if (!gotName || strlen(nameBuf) == 0) {
            SetupDiGetDeviceRegistryPropertyA(hdev, &did, SPDRP_DEVICEDESC, NULL, (PBYTE)nameBuf, sizeof(nameBuf), NULL);
        }
        std::string name = nameBuf;
        if (name.find("AI Boost") != std::string::npos || 
            name.find("NPU") != std::string::npos || 
            name.find("Neural") != std::string::npos ||
            name.find("Compute Accelerator") != std::string::npos) {
            info.detected = true;
            info.name = name;
            info.status = "Ready (ComputeAccelerator)";
            break;
        }
        idx++;
    }
    SetupDiDestroyDeviceInfoList(hdev);
    return info;
}

// --- PHYSICAL DRIVES PROBE ---
std::vector<DiskInfo> probeDisks() {
    std::vector<DiskInfo> disks;
    int consecutiveFailures = 0;
    for (int i = 0; i < 32; i++) {
        std::string path = "\\\\.\\PhysicalDrive" + std::to_string(i);
        HANDLE hDisk = CreateFileA(path.c_str(), 0, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL, OPEN_EXISTING, 0, NULL);
        if (hDisk != INVALID_HANDLE_VALUE) {
            consecutiveFailures = 0;
            STORAGE_PROPERTY_QUERY query = { StorageDeviceProperty, PropertyStandardQuery };
            BYTE buffer[1024] = { 0 };
            DWORD bytesReturned = 0;

            if (DeviceIoControl(hDisk, IOCTL_STORAGE_QUERY_PROPERTY, &query, sizeof(query), buffer, sizeof(buffer), &bytesReturned, NULL)) {
                STORAGE_DEVICE_DESCRIPTOR* desc = (STORAGE_DEVICE_DESCRIPTOR*)buffer;
                DiskInfo disk;
                disk.driveIndex = i;

                if (desc->ProductIdOffset > 0 && desc->ProductIdOffset < bytesReturned) {
                    disk.model = (char*)(buffer + desc->ProductIdOffset);
                    // Trim trailing spaces
                    while (!disk.model.empty() && isspace(static_cast<unsigned char>(disk.model.back()))) disk.model.pop_back();
                }

                switch (desc->BusType) {
                    case BusTypeNvme: disk.busType = "NVMe (PCIe)"; break;
                    case BusTypeSata: disk.busType = "SATA"; break;
                    case BusTypeUsb:  disk.busType = "USB"; break;
                    default:          disk.busType = "Other"; break;
                }

                // Query Drive Geometry / Size
                DISK_GEOMETRY_EX geom = { 0 };
                if (DeviceIoControl(hDisk, IOCTL_DISK_GET_DRIVE_GEOMETRY_EX, NULL, 0, &geom, sizeof(geom), &bytesReturned, NULL)) {
                    disk.sizeBytes = geom.DiskSize.QuadPart;
                }

                disks.push_back(disk);
            }
            CloseHandle(hDisk);
        } else {
            consecutiveFailures++;
            if (i >= 4 && consecutiveFailures >= 4) {
                break;
            }
        }
    }
    return disks;
}

int main(int argc, char* argv[]) {
    auto tStart = std::chrono::high_resolution_clock::now();

    CpuInfo cpu = probeCpu();
    MemoryInfo mem = probeMemory();
    BatteryInfo bat = probeBattery();
    std::vector<GpuInfo> gpus = probeGpus();
    NpuInfo npu = probeNpu();
    std::vector<DiskInfo> disks = probeDisks();

    auto tEnd = std::chrono::high_resolution_clock::now();
    double elapsedMs = std::chrono::duration<double, std::milli>(tEnd - tStart).count();

    std::stringstream json;
    json << "{\n";
    json << "  \"engine\": \"Zenith Native Hardware Probe V1.0\",\n";
    json << "  \"execution_time_ms\": " << elapsedMs << ",\n";
    json << "  \"cpu\": {\n";
    json << "    \"model\": \"" << escape_json(cpu.modelName) << "\",\n";
    json << "    \"total_cores\": " << cpu.totalCores << ",\n";
    json << "    \"total_threads\": " << cpu.totalThreads << ",\n";
    json << "    \"p_cores\": " << cpu.pCores << ",\n";
    json << "    \"e_cores\": " << cpu.eCores << "\n";
    json << "  },\n";
    json << "  \"npu\": {\n";
    json << "    \"detected\": " << (npu.detected ? "true" : "false") << ",\n";
    json << "    \"name\": \"" << escape_json(npu.name) << "\",\n";
    json << "    \"status\": \"" << escape_json(npu.status) << "\"\n";
    json << "  },\n";
    json << "  \"memory\": {\n";
    json << "    \"total_gb\": " << (mem.totalPhysicalBytes / (1024.0 * 1024.0 * 1024.0)) << ",\n";
    json << "    \"used_gb\": " << (mem.usedPhysicalBytes / (1024.0 * 1024.0 * 1024.0)) << ",\n";
    json << "    \"usage_percent\": " << mem.usagePercentage << "\n";
    json << "  },\n";
    json << "  \"displays\": [\n";
    for (size_t i = 0; i < gpus.size(); i++) {
        json << "    {\n";
        json << "      \"adapter\": \"" << escape_json(gpus[i].adapterName) << "\",\n";
        json << "      \"resolution\": \"" << gpus[i].currentWidth << "x" << gpus[i].currentHeight << "\",\n";
        json << "      \"refresh_rate_hz\": " << gpus[i].refreshRateHz << ",\n";
        json << "      \"bpp\": " << gpus[i].bitsPerPixel << "\n";
        json << "    }" << (i + 1 < gpus.size() ? "," : "") << "\n";
    }
    json << "  ],\n";
    json << "  \"storage\": [\n";
    for (size_t i = 0; i < disks.size(); i++) {
        json << "    {\n";
        json << "      \"drive_index\": " << disks[i].driveIndex << ",\n";
        json << "      \"model\": \"" << escape_json(disks[i].model) << "\",\n";
        json << "      \"bus_type\": \"" << escape_json(disks[i].busType) << "\",\n";
        json << "      \"size_gb\": " << (disks[i].sizeBytes / (1000.0 * 1000.0 * 1000.0)) << "\n";
        json << "    }" << (i + 1 < disks.size() ? "," : "") << "\n";
    }
    json << "  ],\n";
    json << "  \"battery\": {\n";
    json << "    \"has_battery\": " << (bat.hasBattery ? "true" : "false") << ",\n";
    json << "    \"device_name\": \"" << escape_json(bat.deviceName) << "\",\n";
    json << "    \"chemistry\": \"" << escape_json(bat.chemistry) << "\",\n";
    json << "    \"design_capacity_mwh\": " << bat.designCapacityMWh << ",\n";
    json << "    \"cycle_count\": " << bat.cycleCount << ",\n";
    json << "    \"is_charging\": " << (bat.isCharging ? "true" : "false") << ",\n";
    json << "    \"is_discharging\": " << (bat.isDischarging ? "true" : "false") << ",\n";
    json << "    \"rate_mw\": " << bat.rateMilliwatts << ",\n";
    json << "    \"remaining_mwh\": " << bat.remainingCapacityMWh << ",\n";
    json << "    \"voltage_mv\": " << bat.voltageMillivolts << "\n";
    json << "  }\n";
    json << "}\n";

    std::string jsonStr = json.str();
    std::cout << jsonStr;

    // Cache to file for ultra-fast instant startup (< 1ms)
    std::ofstream cacheFile("hardware_cache.json");
    if (cacheFile.is_open()) {
        cacheFile << jsonStr;
        cacheFile.close();
    }

    return 0;
}
