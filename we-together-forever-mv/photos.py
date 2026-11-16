"""照片清单：按时间线把 照片/ 下每个文件夹排好，写成 photos.js（window.PHOTOS）。换了、加了照片就重跑：
python photos.py
每组一个文件夹 照片/<组名>/，组内按文件名里的数字排；键 = 组名 + 两位序号（cues.json 里用这个键点照片）。
有文件夹不在 GROUPS 里会报错停下（免得新照片悄悄漏掉）。"""
import json, re, unicodedata
from pathlib import Path
root = Path(__file__).resolve().parent; src = root / '照片'
# (组名 = 文件夹名, 有没有孩子)：这个顺序就是片子里的时间线
GROUPS = [('placeA', 0), ('placeB', 0), ('placeC', 0), ('placeD', 0), ('placeE', 0), ('daily', 0), ('placeF', 0), ('grad', 0), ('placeG', 0), ('placeH', 0), ('placeI', 0), ('placeJ', 0), ('youA', 0), ('wed', 0), ('kid1', 1), ('kid2', 1), ('kidsArt', 1), ('famA', 1), ('usA', 0), ('usB', 0), ('youB', 0), ('famB', 1), ('youC', 0), ('youD', 0), ('rose', 0), ('famArt', 1), ('famC', 1), ('youE', 0), ('famD', 1)]
ROT = {}   # 原图横着存的：'组名/文件名': 顺时针转多少度才正
nfc = lambda s: unicodedata.normalize('NFC', s)
def order(p):   # 按文件名里的数字排；同号 jpeg 在 png 前
    n = re.search(r'(\d+)', p.stem)
    return (int(n.group(1)) if n else 0, p.suffix, nfc(p.name))
files = {nfc(str(p.relative_to(src))): p for p in src.rglob('*') if p.is_file() and not p.name.startswith('.')}
out = {'groups': {}, 'files': {}, 'rot': {}, 'kids': [], 'all': []}; seen = set()
for gid, kids in GROUPS:
    ps = sorted((p for rel, p in files.items() if rel.rsplit('/', 1)[0] == gid), key=order)
    if not ps: raise SystemExit(f'文件夹空了或不见了：照片/{gid}')
    keys = []
    for i, p in enumerate(ps):
        k = f'{gid}{i:02d}'; rel = str(p.relative_to(src)); seen.add(nfc(rel)); keys.append(k)
        out['files'][k] = '照片/' + rel
        if nfc(rel) in ROT: out['rot'][k] = ROT[nfc(rel)]
        if kids: out['kids'].append(k)
    out['groups'][gid] = keys; out['all'] += keys
miss = sorted(set(files) - seen)
if miss: raise SystemExit('这些照片不在 GROUPS 的文件夹里，先把文件夹加进 photos.py：\n' + '\n'.join(miss))
(root / 'photos.js').write_text('window.PHOTOS = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n', encoding='utf-8')
print('照片', len(out['all']), '张；', ' '.join(f'{g}:{len(k)}' for g, k in out['groups'].items()))
