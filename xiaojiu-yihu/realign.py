"""单句窄窗重跑强制对齐：副歌连唱让整段对齐塌掉，这里每句只给自己那一窗，三遍重复取中位。输出 out/realign.json。"""
import json, os, subprocess, sys, glob
from pathlib import Path
import numpy as np, torch
from transformers import AutoModelForTokenClassification, AutoProcessor
R = Path(__file__).resolve().parent
L = [l.strip() for l in (R / 'lyrics.txt').read_text(encoding='utf-8').split('\n') if l.strip()]
voc = glob.glob(str(R / 'stems/htdemucs/*/vocals.wav'))[0]
wav = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', voc, '-f', 'f32le', '-ar', '16000', '-ac', '1', '-'], capture_output=True, check=True).stdout, '<f4').copy()
BAR = 2.18024
# 一遍的窗起点：主歌 8 句、副歌 8 句，各 2 小节一句，句头有弱起
vs = [19.40 + k * 2 * BAR for k in range(8)]; cs = [54.10 + k * 2 * BAR for k in range(8)]
PASS = [(0, vs, [0.0, 87.26]), (8, cs, [0.0, 87.28, 122.20])]
MID = 'Qwen/Qwen3-ForcedAligner-0.6B-hf'
proc = AutoProcessor.from_pretrained(MID)
model = AutoModelForTokenClassification.from_pretrained(MID, dtype=torch.bfloat16).eval()
out = {}
for base, starts, shifts in PASS:
    for k, st in enumerate(starts):
        line = L[base + k]; cand = []
        for sh in shifts:
            s0, s1 = st + sh - 0.35, st + sh + 2 * BAR + 0.75
            inp, words = proc.prepare_forced_aligner_inputs(audio=wav[int(s0 * 16000):int(s1 * 16000)], transcript=line, language='Chinese')
            inp = inp.to('cpu', torch.bfloat16)
            with torch.inference_mode(): o = model(**inp)
            it = proc.decode_forced_alignment(logits=o.logits, input_ids=inp['input_ids'], word_lists=words, timestamp_token_id=model.config.timestamp_token_id)[0]
            ts = [round(s0 + float(x['start_time']) - sh, 2) for x in it]; te = [round(s0 + float(x['end_time']) - sh, 2) for x in it]
            cand.append((ts, te))
        out[base + k + 1] = cand
        print(base + k + 1, line)
        for (ts, te), sh in zip(cand, shifts): print('   ', [round(t, 2) for t in ts], 'end', te[-1], 'sh', sh)
(R / 'out').mkdir(exist_ok=True); (R / 'out/realign.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
