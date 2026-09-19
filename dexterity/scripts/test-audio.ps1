param([string]$OutputFile, [string]$Text='Teach me how to use these buttons on my screen.')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$dexteritySynth=New-Object System.Speech.Synthesis.SpeechSynthesizer
$dexterityFormat=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
try {$dexteritySynth.SetOutputToWaveFile($OutputFile,$dexterityFormat);$dexteritySynth.Speak($Text);$dexteritySynth.SetOutputToNull()}finally{$dexteritySynth.Dispose()}
