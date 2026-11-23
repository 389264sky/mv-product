# 用本机 ComfyUI 的 Z-Image Turbo 按 jobs.json 出图，参数取自 ComfyUI 自带蓝图
import json, pathlib, sys, time, urllib.request as u
BASE = 'http://127.0.0.1:8199'
SUFFIX = (' Style: black-and-white Japanese seinen manga page art, inked by hand with a G-pen nib: crisp confident lines '
          'that taper at both ends, thick outer contour and thin inner detail lines, solid spot blacks in hair and deep '
          'shadows, fine parallel hatching for form. Midtone shading is drawn as FLAT LIGHT-GREY areas - no gradients, no '
          'airbrush, no painterly rendering, no colour except where explicitly stated. Absolutely no text, no letters, no '
          'sound effects, no speech bubbles, no panel borders, no signature, no watermark, no logo.')

def workflow(j):
    wf = {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_bf16.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3}},
        '5': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['2', 0], 'text': j['prompt'] + SUFFIX}},
        '6': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['5', 0]}},
        '7': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': j['w'], 'height': j['h'], 'batch_size': 1}},
        '8': {'class_type': 'KSampler', 'inputs': {'model': ['4', 0], 'seed': j['seed'], 'steps': 8, 'cfg': 1,
              'sampler_name': 'res_multistep', 'scheduler': 'simple', 'positive': ['5', 0], 'negative': ['6', 0],
              'latent_image': ['7', 0], 'denoise': 1}},
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': j['name']}},
    }
    if j.get('init'):   # 图生图：从用户给的照片出发，保住脸型和五官
        wf['11'] = {'class_type': 'LoadImage', 'inputs': {'image': j['init']}}
        wf['12'] = {'class_type': 'ImageScale', 'inputs': {'image': ['11', 0], 'upscale_method': 'lanczos', 'width': j['w'], 'height': j['h'], 'crop': 'center'}}
        wf['13'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['12', 0], 'vae': ['3', 0]}}
        wf['8']['inputs'].update(latent_image=['13', 0], denoise=j['denoise'])
        del wf['7']
        if j.get('mask'):   # 局部重绘：只改遮罩内
            wf['14'] = {'class_type': 'LoadImageMask', 'inputs': {'image': j['mask'], 'channel': 'red'}}
            wf['15'] = {'class_type': 'SetLatentNoiseMask', 'inputs': {'samples': ['13', 0], 'mask': ['14', 0]}}
            wf['8']['inputs']['latent_image'] = ['15', 0]
    return wf

def call(path, data=None):
    req = u.Request(BASE + path, data=json.dumps(data).encode() if data else None, headers={'Content-Type': 'application/json'})
    return json.load(u.urlopen(req, timeout=30))

OUT = pathlib.Path(__file__).resolve().parents[1] / 'out/comfy/output'
for j in json.load(open(sys.argv[1], encoding='utf-8')):
    if list(OUT.glob(j['name'] + '_*.png')):   # 断线重跑时跳过已出的图
        continue
    t0 = time.time()
    pid = call('/prompt', {'prompt': workflow(j)})['prompt_id']
    while True:
        h = call('/history/' + pid).get(pid)
        if h and h.get('status', {}).get('completed'): break
        if h and h.get('status', {}).get('status_str') == 'error': sys.exit(f"✗ {j['name']}: {h['status']}")
        time.sleep(1)
    print(j['name'], h['outputs']['10']['images'][0]['filename'], f'{time.time() - t0:.0f}s', flush=True)
