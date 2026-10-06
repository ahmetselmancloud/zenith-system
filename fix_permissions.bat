@echo off
title Zenith System — MSI Hardware Access Setup
echo ==============================================================
echo  Zenith System — MSI Donanim Erisim Yetkilendirmesi
echo ==============================================================
echo.
echo Bu islem, Zenith'in MSI Fan (CoolerBoost) ve Klavye RGB isiklarini
echo yonetici izni engeline takilmadan dogrudan kontrol edebilmesini saglar.
echo.
echo Lutfen acilacak pencerede "Evet" (Yes) secenegini secin...
echo.
powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\grant_msi_access.ps1\"' -Verb RunAs"
echo.
echo ==============================================================
echo [TAMAMLANDI] Yetkiler tanimlandi. Artik tum donanim kontrolleri aktif!
echo ==============================================================
pause
