param([string]$DexterityParentPid = '0', [switch]$SelfTest, [switch]$TestForm)
$ErrorActionPreference = 'Stop'
$dexterityFramework = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$dexteritySpeech = Get-ChildItem (Join-Path $env:WINDIR 'Microsoft.NET/assembly/GAC_MSIL/System.Speech') -Recurse -Filter System.Speech.dll | Select-Object -First 1 -ExpandProperty FullName
if (-not $dexteritySpeech) { throw 'Windows speech components are unavailable.' }
Add-Type -Path (Join-Path $PSScriptRoot 'Dexterity.Native.cs') -ReferencedAssemblies @('System.Windows.Forms','System.Drawing','System.Web.Extensions','System.Core',$dexteritySpeech,"$dexterityFramework/WPF/UIAutomationClient.dll","$dexterityFramework/WPF/UIAutomationTypes.dll","$dexterityFramework/WPF/WindowsBase.dll")
if ($SelfTest) { [DexterityNative]::Main(@('--self-test')) }
elseif ($TestForm) { [DexterityNative]::Main(@('--test-form')) }
else { [DexterityNative]::Main(@($DexterityParentPid)) }
