import glob, json, sys
from PIL import Image
p = sys.argv[1]
names = [j['name'].split('/')[1] for j in json.load(open(p + '/gen/jobs_film.json', encoding='utf-8'))]
for page in range(2):
    s = Image.new('RGB', (1920, 1080), 'white')
    for i, n in enumerate(names[page * 9:page * 9 + 9]):
        fs = sorted(glob.glob(f'{p}/out/comfy/output/film/{n}_*.png'))
        if not fs: continue
        im = Image.open(fs[-1]).convert('RGB'); im.thumbnail((640, 360), Image.LANCZOS)
        s.paste(im, (i % 3 * 640 + (640 - im.width) // 2, i // 3 * 360 + (360 - im.height) // 2))
    s.save(f'{p}/out/film_sheet{page + 1}.jpg', quality=90)
print('sheets ok')
