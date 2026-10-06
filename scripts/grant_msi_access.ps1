# Zenith System — MSI Registry Access Configurator
# Grants BUILTIN\Users FullControl permissions to MSI Center Component registry subkeys.
# This allows instant, frictionless hardware fan, scenario, and RGB lighting control
# without triggering repeated UAC prompts.

$keys = @(
    "SOFTWARE\WOW6432Node\MSI\MSI Center\Component"
)

foreach ($relPath in $keys) {
    try {
        $regKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey(
            $relPath,
            [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,
            [System.Security.AccessControl.RegistryRights]::ChangePermissions
        )
        if ($regKey) {
            $acl = $regKey.GetAccessControl()
            $rule = New-Object System.Security.AccessControl.RegistryAccessRule(
                "BUILTIN\Users",
                [System.Security.AccessControl.RegistryRights]::FullControl,
                [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit,
                [System.Security.AccessControl.PropagationFlags]::None,
                [System.Security.AccessControl.AccessControlType]::Allow
            )
            $acl.AddAccessRule($rule)
            $regKey.SetAccessControl($acl)
            $regKey.Close()
            Write-Host "[OK] MSI Hardware registry permissions granted for BUILTIN\Users." -ForegroundColor Green
        }
    } catch {
        Write-Warning "Could not grant permissions for $relPath : $_"
    }
}
