$ErrorActionPreference = 'Stop'
$dexterityRoot = Split-Path -Parent $PSScriptRoot
$dexterityFramework = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$dexteritySpeech = Get-ChildItem (Join-Path $env:WINDIR 'Microsoft.NET/assembly/GAC_MSIL/System.Speech') -Recurse -Filter System.Speech.dll | Select-Object -First 1 -ExpandProperty FullName
if (-not $dexteritySpeech) { throw 'Windows System.Speech is required.' }
$dexterityOutput = Join-Path $dexterityRoot 'native/build/Dexterity.Native.exe'
New-Item -ItemType Directory -Force (Split-Path $dexterityOutput) | Out-Null
& (Join-Path $dexterityFramework 'csc.exe') /nologo /target:exe /platform:x64 /optimize+ "/out:$dexterityOutput" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/r:$dexteritySpeech" "/r:$dexterityFramework/WPF/UIAutomationClient.dll" "/r:$dexterityFramework/WPF/UIAutomationTypes.dll" "/r:$dexterityFramework/WPF/WindowsBase.dll" (Join-Path $dexterityRoot 'native/Dexterity.Native.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native helper compilation failed.' }
Write-Output 'Built Windows voice, gesture and form helper.'
