"""Compara modelos de voz a texto sobre los audios guardados en el teléfono (eval/phase0/audio).
Cuando se sabe la frase dicha (--expect), mide aciertos exactos; si no, muestra las salidas lado a lado.

Uso: python -I scripts/eval-stt.py G:/Dev/_downloads/vigia-models eval/phase0/audio --since 1792545000000 --expect "qué hora es"
"""
import argparse, json, re, unicodedata, wave
from pathlib import Path

import numpy as np
import sherpa_onnx as so

ap = argparse.ArgumentParser()
ap.add_argument("models", type=Path)
ap.add_argument("audio", type=Path)
ap.add_argument("--since", type=int, default=0, help="solo audios con marca de tiempo (ms) mayor o igual")
ap.add_argument("--expect", default=None, help="frase que se dijo en el comando, para contar aciertos")
args = ap.parse_args()
SR = 16000

def ctc():
    d = args.models / "sherpa-onnx-nemo-fast-conformer-ctc-es-1424-int8"
    return so.OfflineRecognizer.from_nemo_ctc(model=str(d / "model.int8.onnx"), tokens=str(d / "tokens.txt"), num_threads=4)

def transducer():
    d = args.models / "sherpa-onnx-nemo-fast-conformer-transducer-es-1424-int8"
    return so.OfflineRecognizer.from_transducer(encoder=str(d / "encoder.int8.onnx"), decoder=str(d / "decoder.int8.onnx"),
                                               joiner=str(d / "joiner.int8.onnx"), tokens=str(d / "tokens.txt"),
                                               num_threads=4, model_type="nemo_transducer")

def read(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768

def plain(text):
    text = unicodedata.normalize("NFD", text.lower())
    return re.sub(r"[^a-z ]", "", "".join(c for c in text if unicodedata.category(c) != "Mn")).split()

def correct(text, expect):
    """El comando esperado aparece completo (sin tildes ni signos) en la transcripción."""
    want, got = plain(expect), plain(text)
    return any(got[i:i + len(want)] == want for i in range(len(got) - len(want) + 1))

events = [json.loads(l) for l in (args.audio / "events.jsonl").read_text(encoding="utf-8").splitlines()]
# Comandos: tramos "command" y tramos de activación que ya traen el comando ("Hola Alfred, ¿qué hora es?").
clips = [e for e in events if int(e["file"].split("-")[0]) >= args.since and (e["kind"] == "command" or e["kind"].startswith("heard"))]
models = {"ctc": ctc(), "transducer": transducer()}
print(f"{len(clips)} audios\n")
hits = {m: 0 for m in models}
for e in clips:
    audio = read(args.audio / e["file"])
    row = []
    for name, rec in models.items():
        s = rec.create_stream(); s.accept_waveform(SR, audio); rec.decode_stream(s)
        text = s.result.text.strip()
        if args.expect and correct(text, args.expect): hits[name] += 1
        row.append(f"{name}: «{text}»")
    print(f"{e['kind']:>12} {len(audio) / SR:4.1f} s | " + " | ".join(row))
if args.expect:
    print("\nAciertos de «%s»: " % args.expect + ", ".join(f"{m} {h}/{len(clips)}" for m, h in hits.items()))
