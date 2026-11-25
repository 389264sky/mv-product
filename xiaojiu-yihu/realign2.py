"""副歌每句多个窗起点 × 三遍 × 单句/两句上下文，取中位和离散度。输出 out/realign2.json。"""
import json, subprocess, glob
from pathlib import Path
import numpy as np, torch
from transformers import AutoModelForTokenClassification, AutoProcessor
R = Path(__file__).resolve().parent
L = [l.strip() for l in (R / 'lyrics.txt').read_text(encoding='utf-8').split('\n') if l.strip()]
voc = glob.glob(str(R / 'stems/htdemucs/*/vocals.wav'))[0]
wav = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', voc, '-f', 'f32le', '-ar', '16000', '-ac', '1', '-'], capture_output=True, check=True).stdout, '<f4').copy()
MID = 'Qwen/Qwen3-ForcedAligner-0.6B-hf'
proc = AutoProcessor.from_pretrained(MID); model = AutoModelForTokenClassification.from_pretrained(MID, dtype=torch.bfloat16).eval()
def run(s0, s1, text):
    inp, words = proc.prepare_forced_aligner_inputs(audio=wav[int(s0 * 16000):int(s1 * 16000)], transcript=text, language='Chinese')
    inp = inp.to('cpu', torch.bfloat16)
    with torch.inference_mode(): o = model(**inp)
    it = proc.decode_forced_alignment(logits=o.logits, input_ids=inp['input_ids'], word_lists=words, timestamp_token_id=model.config.timestamp_token_id)[0]
    return [(s0 + float(x['start_time']), s0 + float(x['end_time'])) for x in it]
B = 2.18024; SH = [0.0, 87.28, 122.20]; C0 = 54.60
res = {}
for k in range(8):
    n = 9 + k; line = L[n - 1]; nc = len([c for c in line if c.strip()])
    st = C0 + k * 2 * B; rows = []
    for sh in SH:
        for back in (0.2, 0.5, 0.9):
            for fwd in (0.3, 0.8):
                s0 = st + sh - back; s1 = st + sh + 2 * B + fwd
                r = run(s0, s1, line); rows.append([a - sh for a, _ in r])
        # 两句上下文
        if k < 7:
            s0 = st + sh - 0.4; s1 = st + sh + 4 * B + 0.4
            r = run(s0, s1, line + '\n' + L[n]); rows.append([a - sh for a, _ in r[:nc]])
    A = np.array(rows); res[n] = A.tolist()
    print(n, line); print('  med', np.round(np.median(A, 0), 2)); print('  p15', np.round(np.percentile(A, 15, 0), 2)); print('  p85', np.round(np.percentile(A, 85, 0), 2))
(R / 'out/realign2.json').write_text(json.dumps(res), encoding='utf-8')
