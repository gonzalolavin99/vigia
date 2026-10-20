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
# Modelo solo español (NVIDIA NeMo, 1424 h) para comandos y activación por texto (ADR-018, ADR-019).
$nemoName = 'sherpa-onnx-nemo-fast-conformer-ctc-es-1424-int8'
$kwsSource = Join-Path $modelCache $kwsName
$nemoSource = Join-Path $modelCache $nemoName
Get-ModelArchive "https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/$kwsName.tar.bz2" (Join-Path $modelCache "$kwsName.tar.bz2") $kwsSource
Get-ModelArchive "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$nemoName.tar.bz2" (Join-Path $modelCache "$nemoName.tar.bz2") $nemoSource
$vadModel = Join-Path $modelRoot 'silero_vad.onnx'
if (!(Test-Path $vadModel)) { Invoke-WebRequest 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx' -OutFile $vadModel }

$kwsAssets = Join-Path $assetRoot 'kws'
$nemoAssets = Join-Path $assetRoot 'nemo-es'
New-Item -ItemType Directory -Force $kwsAssets, $nemoAssets | Out-Null
foreach ($name in @('encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx', 'tokens.txt', 'bpe.model')) {
  Copy-Item (Join-Path $kwsSource $name) $kwsAssets -Force
}
foreach ($name in @('model.int8.onnx', 'tokens.txt')) {
  Copy-Item (Join-Path $nemoSource $name) $nemoAssets -Force
}
Copy-Item $vadModel (Join-Path $assetRoot 'silero_vad.onnx') -Force

$rawKeywords = Join-Path $modelCache 'keywords_raw.txt'
$compiledKeywords = Join-Path $kwsSource 'keywords-vigia.txt'
# @ETIQUETA hace que el KWS devuelva qué frase se detectó, para medir cada una por separado (A1).
# :boost #umbral por frase; variantes fonéticas de cómo suena "Alfred" en español (fase 0, 16 oct).
Set-Content -LiteralPath $rawKeywords -Value @(
  'HEY ALFRED :2.5 #0.15 @HEY_ALFRED', 'HEY ALFRET :2.5 #0.15 @HEY_ALFRED',
  'OYE ALFRED :2.5 #0.15 @OYE_ALFRED', 'OI ALFRED :2.5 #0.15 @OYE_ALFRED', 'OY ALFRED :2.5 #0.15 @OYE_ALFRED',
  'ALFRED :2.5 #0.2 @ALFRED', 'ALFRET :2.5 #0.2 @ALFRED', 'ALFRID :2.5 #0.2 @ALFRED'
) -Encoding utf8
& $sherpaCli text2token --tokens (Join-Path $kwsSource 'tokens.txt') --tokens-type bpe --bpe-model (Join-Path $kwsSource 'bpe.model') $rawKeywords $compiledKeywords
if ($LASTEXITCODE -ne 0) { throw 'No pude convertir las palabras clave con text2token.' }
Copy-Item $compiledKeywords (Join-Path $kwsAssets 'keywords.txt') -Force

$total = (Get-ChildItem $assetRoot -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("Modelos listos en android/app/src/main/assets/models ({0:N1} MiB)." -f ($total / 1MB))
