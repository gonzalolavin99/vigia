$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelCache = 'G:\Dev\_downloads\vigia-models'
$venvPython = 'G:\Dev\venvs\vigia\Scripts\python.exe'
$sherpaCli = 'G:\Dev\venvs\vigia\Scripts\sherpa-onnx-cli.exe'
$modelRoot = Join-Path $modelCache 'models'
$assetRoot = Join-Path $repoRoot 'android\app\src\main\assets\models'

if (!(Test-Path $venvPython) -or !(Test-Path $sherpaCli)) {
  throw "No encuentro sherpa-onnx en $venvPython. Prepara primero el venv de G:\Dev."
}
New-Item -ItemType Directory -Force $modelCache, $modelRoot, $assetRoot | Out-Null
& $venvPython -m pip install --no-cache-dir -q click sentencepiece pypinyin
if ($LASTEXITCODE -ne 0) { throw 'No pude instalar las dependencias de text2token.' }

function Get-ModelArchive([string]$Url, [string]$Archive, [string]$Directory) {
  if (!(Test-Path $Directory)) {
    if (!(Test-Path $Archive)) { Invoke-WebRequest $Url -OutFile $Archive }
    tar -xjf $Archive -C $modelCache
    if ($LASTEXITCODE -ne 0 -or !(Test-Path $Directory)) { throw "No pude extraer $Archive" }
  }
}

$kwsName = 'sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01'
$whisperName = 'sherpa-onnx-whisper-tiny'
$kwsSource = Join-Path $modelCache $kwsName
$whisperSource = Join-Path $modelCache $whisperName
Get-ModelArchive "https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/$kwsName.tar.bz2" (Join-Path $modelCache "$kwsName.tar.bz2") $kwsSource
Get-ModelArchive "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$whisperName.tar.bz2" (Join-Path $modelCache "$whisperName.tar.bz2") $whisperSource
$vadModel = Join-Path $modelRoot 'silero_vad.onnx'
if (!(Test-Path $vadModel)) { Invoke-WebRequest 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx' -OutFile $vadModel }

$kwsAssets = Join-Path $assetRoot 'kws'
$whisperAssets = Join-Path $assetRoot 'whisper'
New-Item -ItemType Directory -Force $kwsAssets, $whisperAssets | Out-Null
foreach ($name in @('encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'tokens.txt', 'bpe.model')) {
  Copy-Item (Join-Path $kwsSource $name) $kwsAssets -Force
}
foreach ($name in @('tiny-encoder.int8.onnx', 'tiny-decoder.int8.onnx', 'tiny-tokens.txt')) {
  Copy-Item (Join-Path $whisperSource $name) $whisperAssets -Force
}
Copy-Item $vadModel (Join-Path $assetRoot 'silero_vad.onnx') -Force

$rawKeywords = Join-Path $modelCache 'keywords_raw.txt'
$compiledKeywords = Join-Path $kwsSource 'keywords-vigia.txt'
Set-Content -LiteralPath $rawKeywords -Value @('HEY ALFRED', 'ALFRED', 'OYE ALFRED') -Encoding utf8
& $sherpaCli text2token --tokens (Join-Path $kwsSource 'tokens.txt') --tokens-type bpe --bpe-model (Join-Path $kwsSource 'bpe.model') $rawKeywords $compiledKeywords
if ($LASTEXITCODE -ne 0) { throw 'No pude convertir las palabras clave con text2token.' }
Copy-Item $compiledKeywords (Join-Path $kwsAssets 'keywords.txt') -Force

$total = (Get-ChildItem $assetRoot -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("Modelos listos en android/app/src/main/assets/models ({0:N1} MiB)." -f ($total / 1MB))
