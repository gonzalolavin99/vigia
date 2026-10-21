"""Simula hablar más lejos del teléfono atenuando los audios guardados y mide qué ajuste del VAD
y de ganancia mantiene la activación por "Alfred" (ADR-018). Corre en el PC con el venv de G:\\Dev.

Uso: python -I scripts/eval-distance.py G:/Dev/_downloads/vigia-models eval/phase0/audio
"""
import json, re, sys, wave
from pathlib import Path

import numpy as np
import sherpa_onnx as so

models, audio_dir = Path(sys.argv[1]), Path(sys.argv[2])
SR = 16000
WAKE = re.compile(r"(?<![^\W\d_])(alf(?=[re]|[\W\d_]|$)[^\W\d_]*|al f[re][^\W\d_]*)")

nemo = so.OfflineRecognizer.from_nemo_ctc(
    model=str(models / "sherpa-onnx-nemo-fast-conformer-ctc-es-1424-int8/model.int8.onnx"),
    tokens=str(models / "sherpa-onnx-nemo-fast-conformer-ctc-es-1424-int8/tokens.txt"), num_threads=4)

def read(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768

def vad_segments(audio, threshold, preroll_s=0.0):
    cfg = so.VadModelConfig()
    cfg.silero_vad.model = str(Path(__file__).resolve().parent.parent / "android/app/src/main/assets/models/silero_vad.onnx")
    cfg.silero_vad.threshold = threshold
    cfg.silero_vad.min_silence_duration = 0.4
    cfg.silero_vad.min_speech_duration = 0.25
    cfg.sample_rate = SR
    vad = so.VoiceActivityDetector(cfg, buffer_size_in_seconds=30)
    for i in range(0, len(audio), 512):
        vad.accept_waveform(audio[i:i + 512])
    vad.flush()
    out = []
    while not vad.empty():
        # Pre-roll: el VAD corta el inicio de la voz, justo donde va "Alfred".
        start = max(0, vad.front.start - int(preroll_s * SR)); end = vad.front.start + len(vad.front.samples)
        out.append(audio[start:end].astype(np.float32)); vad.pop()
    return out

def normalize(segment, target_dbfs=-20.0, max_gain_db=24.0):
    rms = float(np.sqrt(np.mean(segment ** 2)) + 1e-9)
    gain_db = min(max_gain_db, target_dbfs - 20 * np.log10(rms))
    return np.clip(segment * 10 ** (gain_db / 20), -1, 1) if gain_db > 0 else segment

def transcribe(segment):
    s = nemo.create_stream(); s.accept_waveform(SR, segment); nemo.decode_stream(s)
    return s.result.text

events = [json.loads(l) for l in (audio_dir / "events.jsonl").read_text(encoding="utf-8").splitlines()]
wakes = [e for e in events if e["kind"].startswith("heard") and WAKE.search(e["text"].lower())]
rng = np.random.default_rng(0)
print(f"{len(wakes)} tramos con \"Alfred\" (grabados a ~1 m)\n")
print(f"{'atenuación':>10} {'VAD':>5} {'pre-roll':>9} {'ganancia':>9} {'detectados':>11}")
for att_db in (0, 6, 12):
    for threshold, preroll in ((0.5, 0.0), (0.35, 0.0), (0.35, 0.3), (0.25, 0.3)):
        for gain in (False, True):
            hits = 0
            for e in wakes:
                clip = read(audio_dir / e["file"]) * 10 ** (-att_db / 20)
                # Medio segundo de silencio con ruido de sala (~-60 dBFS) a cada lado, como en el uso real.
                pad = (rng.standard_normal(SR // 2) * 0.001).astype(np.float32)
                stream = np.concatenate([pad, clip, pad]) + (rng.standard_normal(len(clip) + SR) * 0.001).astype(np.float32)
                segs = vad_segments(stream, threshold, preroll)
                if any(WAKE.search(transcribe(normalize(s) if gain else s).lower()) for s in segs):
                    hits += 1
            print(f"{att_db:>8} dB {threshold:>5} {preroll:>7} s {'sí' if gain else 'no':>9} {hits:>5}/{len(wakes)}")
