"""《惊蛰》前奏、A2（整首 bar1–16，0–32.45 秒）：冬夜结冰的湖，用 Cycles 照真的画。
机位、冰洞多大、火种在哪多亮，逐帧从 blender/track.json 读（track.py 从 jz_lake.js 导出，预览的着色器版本用同一份）。
坐标：three.js 的 (x, y, z) → Blender 的 (x, -z, y)；水面 z = 0，冰面 z = 0.03，冰底 z = -0.29。
"""
import json, math, os, sys, time
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector, Matrix, Quaternion

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import land  # noqa: E402

TOP, BOT = 0.03, -0.29          # 冰面、冰底（冰厚 32 cm，浮着，水面以上 3 cm）
FPS = 60
CLOG = []


def log(*a):
    CLOG.append(time.time()); print('[build]', *a, flush=True)


def B(v):
    return Vector((v[0], -v[2], v[1]))


# ---------- 噪声（numpy，和 land.py 同一种整数哈希） ----------
def vnoise(x, y, seed):
    ix, iy = np.floor(x), np.floor(y); fx, fy = x - ix, y - iy
    ux, uy = fx ** 3 * (fx * (fx * 6 - 15) + 10), fy ** 3 * (fy * (fy * 6 - 15) + 10)
    def h(a, b):
        return (land.h3(land.ivec(a + 65536), land.ivec(b + 65536), np.full(a.shape, seed, np.uint32)) >> np.uint32(8)).astype(np.float64) / 16777216.0
    a, b, c, d = h(ix, iy), h(ix + 1, iy), h(ix, iy + 1), h(ix + 1, iy + 1)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy


def fbm(x, y, seed, o=4):
    s, a, t = 0.0, 0.5, 0.0
    for k in range(o):
        s = s + a * vnoise(x, y, seed + 17 * k); t += a; x, y = x * 2.03 + 11.7, y * 2.03 + 3.1; a *= 0.5
    return s / t


def sm(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


WD = np.array([0.96, -0.28])    # 风向（Blender xy；three 的 (0.96, 0.28)）


def snow_f(x, y):
    """积雪的场（> 0 有雪）：顺风拉长、扭过的分形噪声 → 一条条雪垄和雪舌，中间露黑冰；火种正上方冰下热，雪薄。"""
    al, ac = x * WD[0] + y * WD[1], -x * WD[1] + y * WD[0]
    qx = al * 0.045 + 0.9 * (fbm(x * 0.04, y * 0.04, 101, 3) - 0.5)
    qy = ac * 0.16 + 0.9 * (fbm(x * 0.04 + 5.2, y * 0.04 + 1.3, 202, 3) - 0.5)
    f = fbm(qx, qy, 303, 5) - 0.53 + 0.07 * (fbm(x * 0.6, y * 0.6, 404, 3) - 0.5)
    return f - 0.25 * (1 - sm(0.8, 3.5, np.hypot(x, y)))


def snow_z(f):
    return np.where(f > 0, TOP + 0.09 * np.sqrt(np.clip(f / 0.10, 0, 1)), TOP + np.maximum(0.6 * f, -0.008))   # 边上陡起来（雪垄的边是齐的），没雪的地方沉进冰里看不见


# ---------- Blender 小工具 ----------
def mesh_obj(name, V, F, mats=(), fidx=None, smooth=True, coll=None):
    me = bpy.data.meshes.new(name)
    V = np.asarray(V, np.float32).reshape(-1, 3); F = np.asarray(F, np.int32)
    me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
    nv = F.shape[1]
    me.loops.add(F.size); me.loops.foreach_set('vertex_index', F.ravel())
    me.polygons.add(len(F)); me.polygons.foreach_set('loop_start', np.arange(0, F.size, nv, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(F), nv, np.int32))
    if fidx is not None: me.polygons.foreach_set('material_index', np.asarray(fidx, np.int32))
    me.polygons.foreach_set('use_smooth', np.full(len(F), smooth, bool))
    me.update(calc_edges=True); me.validate(clean_customdata=False)
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def attr(ob, name, vals, kind='FLOAT', dom='POINT'):
    a = ob.data.attributes.new(name, kind, dom); a.data.foreach_set('vector' if kind == 'FLOAT_VECTOR' else 'value', np.asarray(vals, np.float32).ravel())


def grid_faces(nx, ny, off=0):
    i = np.arange(nx - 1); j = np.arange(ny - 1); I, J = np.meshgrid(i, j, indexing='ij')
    a = off + I * ny + J
    return np.stack([a, a + ny, a + ny + 1, a + 1], -1).reshape(-1, 4)


def fkeys(st, prop, frames, vals, interp='LINEAR'):
    """一条曲线一次写进去（逐帧的值）。st 可以是 ID，也可以是 ID 里的东西（节点插口、形变键）"""
    from bpy_extras import anim_utils
    owner = st.id_data; path = prop if st == owner else st.path_from_id(prop)
    vals = np.asarray(vals, np.float64); cols = [vals] if vals.ndim == 1 else [vals[:, k] for k in range(vals.shape[1])]
    for k, v in enumerate(cols):
        ix = k if vals.ndim > 1 else 0
        owner.keyframe_insert(path, index=ix if vals.ndim > 1 else -1, frame=float(frames[0]))
        ad = owner.animation_data; fc = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot).fcurves.find(path, index=ix)
        fc.keyframe_points.clear(); fc.keyframe_points.add(len(frames))
        fc.keyframe_points.foreach_set('co', np.stack([np.asarray(frames, np.float64), v], 1).ravel())
        fc.keyframe_points.foreach_set('interpolation', np.full(len(frames), {'CONSTANT': 0, 'LINEAR': 1}[interp], np.int32))
        fc.update()


def cached(name, fn):
    """算得慢的（地形、雪、气泡）存进 out/blender_cache，改了生成它的代码就删掉对应的 .npz"""
    f = HERE.parent / 'out' / 'blender_cache' / (name + '.npz'); f.parent.mkdir(parents=True, exist_ok=True)
    if f.exists(): return dict(np.load(f))
    d = fn(); np.savez(f, **d); return d


# ---------- 材质 ----------
def mat(name):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    m.node_tree.nodes.clear(); return m, m.node_tree


def nd(nt, kind, inp=None, **props):
    n = nt.nodes.new(kind)
    if kind == 'ShaderNodeBsdfPrincipled': n.subsurface_method = 'BURLEY'   # 随机游走的次表面太贵
    for k, v in props.items(): setattr(n, k, v)
    for k, v in (inp or {}).items(): n.inputs[k].default_value = v
    return n


def ln(nt, a, b):
    nt.links.new(a, b)


def math_(nt, op, a, b=None, c=None):
    n = nd(nt, 'ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b, c)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: ln(nt, v, n.inputs[i])
    return n.outputs[0]


def vmath(nt, op, a, b=None):
    n = nd(nt, 'ShaderNodeVectorMath', operation=op)
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (tuple, list)): n.inputs[i].default_value = v
        else: ln(nt, v, n.inputs[i])
    return n


def ramp(nt, fac, stops):
    r = nd(nt, 'ShaderNodeValToRGB'); e = r.color_ramp.elements
    for k, (p, c) in enumerate(stops):
        el = e[k] if k < 2 else e.new(p); el.position = p; el.color = c
    ln(nt, fac, r.inputs[0]); return r.outputs[0]


def jag(nt, pos, R):
    """化冰的前沿（几何节点删雪、雪的材质变湿共用，两边对得上）：不是正圆，沿一圈大起大落（跟角度走，随半径放大），
    再加几米大小的碎边；洞小（A2 那 0.9 米）时不加。返回到湖心的距离 r、前沿半径 Rj"""
    sp = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, pos, sp.inputs[0])
    r = math_(nt, 'SQRT', math_(nt, 'ADD', math_(nt, 'MULTIPLY', sp.outputs['X'], sp.outputs['X']), math_(nt, 'MULTIPLY', sp.outputs['Y'], sp.outputs['Y'])))
    rr = math_(nt, 'MAXIMUM', r, 0.001)
    dv = nd(nt, 'ShaderNodeCombineXYZ'); ln(nt, math_(nt, 'DIVIDE', sp.outputs['X'], rr), dv.inputs[0]); ln(nt, math_(nt, 'DIVIDE', sp.outputs['Y'], rr), dv.inputs[1])
    n1 = nd(nt, 'ShaderNodeTexNoise', {'Scale': 1.5, 'Detail': 3.0}); ln(nt, dv.outputs[0], n1.inputs['Vector'])
    n2 = nd(nt, 'ShaderNodeTexNoise', {'Scale': 0.12, 'Detail': 4.0, 'Roughness': 0.6}); ln(nt, pos, n2.inputs['Vector'])
    amp = nd(nt, 'ShaderNodeMapRange', {'From Min': 1.5, 'From Max': 6.0}, interpolation_type='SMOOTHSTEP'); ln(nt, R, amp.inputs['Value'])
    j = math_(nt, 'ADD', math_(nt, 'MULTIPLY', math_(nt, 'SUBTRACT', n1.outputs['Fac'], 0.5), math_(nt, 'MULTIPLY', R, 1.4)), math_(nt, 'MULTIPLY', math_(nt, 'SUBTRACT', n2.outputs['Fac'], 0.5), 10.0))
    return r, math_(nt, 'MULTIPLY_ADD', j, amp.outputs['Result'], R)


def m_snow(name='snow', bump=1.0):
    m, nt = mat(name); out = nd(nt, 'ShaderNodeOutputMaterial')
    p = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.88, 0.91, 0.97, 1), 'Roughness': 0.8, 'Subsurface Weight': 1.0, 'Subsurface Radius': (0.8, 0.9, 1.0), 'Subsurface Scale': 0.04, 'Specular IOR Level': 0.4})
    tc = nd(nt, 'ShaderNodeTexCoord')
    # 化冰前沿外面一圈雪泥：湿了、发暗发亮（cutR 跟删雪的半径一起走）
    cr = nd(nt, 'ShaderNodeValue', label='cutR'); cr.name = 'cutR'; cr.outputs[0].default_value = 0.0
    r, Rj = jag(nt, tc.outputs['Object'], cr.outputs[0])
    wb = nd(nt, 'ShaderNodeMapRange', {'To Min': 1.0, 'To Max': 0.0}, interpolation_type='SMOOTHSTEP'); ln(nt, r, wb.inputs['Value']); ln(nt, Rj, wb.inputs['From Min'])
    ln(nt, math_(nt, 'ADD', Rj, math_(nt, 'MULTIPLY_ADD', cr.outputs[0], 0.15, 0.4)), wb.inputs['From Max'])
    wet = math_(nt, 'MULTIPLY', wb.outputs['Result'], math_(nt, 'GREATER_THAN', cr.outputs[0], 1.5))
    wc = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, wet, wc.inputs['Factor']); wc.inputs['A'].default_value = (0.88, 0.91, 0.97, 1); wc.inputs['B'].default_value = (0.3, 0.33, 0.38, 1)
    ln(nt, wc.outputs['Result'], p.inputs['Base Color']); ln(nt, math_(nt, 'MULTIPLY_ADD', wet, -0.5, 0.8), p.inputs['Roughness'])
    g = nd(nt, 'ShaderNodeTexNoise', {'Scale': 700.0, 'Detail': 3.0, 'Roughness': 0.7}); ln(nt, tc.outputs['Object'], g.inputs['Vector'])                       # 雪粒
    w = nd(nt, 'ShaderNodeTexNoise', {'Scale': 1.6, 'Detail': 2.0}); ln(nt, tc.outputs['Object'], w.inputs['Vector'])
    mp = nd(nt, 'ShaderNodeMapping', {'Scale': (60.0, 6.0, 1.0), 'Rotation': (0, 0, -math.atan2(-0.28, 0.96) + math.pi / 2)}); ln(nt, tc.outputs['Object'], mp.inputs['Vector'])
    wv = nd(nt, 'ShaderNodeTexWave', {'Scale': 1.0, 'Distortion': 6.0, 'Detail': 3.0, 'Detail Scale': 2.0}); ln(nt, mp.outputs[0], wv.inputs['Vector']); ln(nt, w.outputs['Fac'], wv.inputs['Distortion'])   # 风纹：垂直于风向的一道道细棱
    hgt = math_(nt, 'MULTIPLY_ADD', wv.outputs['Fac'], 0.5, g.outputs['Fac'])
    bm = nd(nt, 'ShaderNodeBump', {'Strength': 0.35 * bump, 'Distance': 0.0015}); ln(nt, hgt, bm.inputs['Height']); ln(nt, bm.outputs[0], p.inputs['Normal'])
    # 闪点：一粒粒冰晶的小镜面，大多平躺、朝上歪 ±55°；正好把月光反进镜头的那几粒亮
    vo = nd(nt, 'ShaderNodeTexVoronoi', {'Scale': 320.0}); ln(nt, tc.outputs['Object'], vo.inputs['Vector'])
    cv = vmath(nt, 'MULTIPLY_ADD', vo.outputs['Color'], (2.0, 2.0, 0.0)); cv.inputs[2].default_value = (-1.0, -1.0, 1.3)
    nn = vmath(nt, 'NORMALIZE', cv.outputs[0])
    gl = nd(nt, 'ShaderNodeBsdfGlossy', {'Roughness': 0.03, 'Color': (1, 1, 1, 1)}); ln(nt, nn.outputs[0], gl.inputs['Normal'])
    sep = nd(nt, 'ShaderNodeSeparateColor'); ln(nt, vo.outputs['Color'], sep.inputs[0])
    gm = math_(nt, 'MULTIPLY', math_(nt, 'GREATER_THAN', sep.outputs[2], 0.55), 0.35)
    mx = nd(nt, 'ShaderNodeMixShader'); ln(nt, gm, mx.inputs[0]); ln(nt, p.outputs[0], mx.inputs[1]); ln(nt, gl.outputs[0], mx.inputs[2])
    ln(nt, mx.outputs[0], out.inputs['Surface']); return m


def ice_volume(nt, out):
    v = nd(nt, 'ShaderNodeVolumeAbsorption', {'Color': (0.72, 0.9, 0.95, 1), 'Density': 0.6})
    ln(nt, v.outputs[0], out.inputs['Volume'])


def m_ice(name, kind):
    """kind：top 冰面（菲涅尔反光 + 透过去，上面一层薄霜、风吹的雪粉）；bot 冰底（冰→水几乎看不见）；wall 冰洞水面以上的断口；wwet 水下的冰壁"""
    m, nt = mat(name); out = nd(nt, 'ShaderNodeOutputMaterial'); ice_volume(nt, out)
    tr = nd(nt, 'ShaderNodeBsdfTransparent')
    if kind == 'bot':
        ln(nt, tr.outputs[0], out.inputs['Surface']); return m
    tc = nd(nt, 'ShaderNodeTexCoord')
    gl = nd(nt, 'ShaderNodeBsdfGlossy', {'Roughness': 0.012 if kind == 'top' else 0.05})
    lwf = nd(nt, 'ShaderNodeLayerWeight', {'Blend': 0.5}); f0 = 0.018 if kind != 'wwet' else 0.00006
    frv = math_(nt, 'MULTIPLY_ADD', math_(nt, 'POWER', lwf.outputs['Facing'], 5.0), 1.0 - f0, f0)   # Schlick，正反两面一样
    if kind == 'top':   # 冰面不平：冻住时的微波、刮痕，倒影跟着歪一点
        n1 = nd(nt, 'ShaderNodeTexNoise', {'Scale': 0.7, 'Detail': 3.0}); ln(nt, tc.outputs['Object'], n1.inputs['Vector'])
        n2 = nd(nt, 'ShaderNodeTexNoise', {'Scale': 40.0, 'Detail': 2.0}); ln(nt, tc.outputs['Object'], n2.inputs['Vector'])
        bm = nd(nt, 'ShaderNodeBump', {'Strength': 0.06, 'Distance': 0.02}); ln(nt, math_(nt, 'MULTIPLY_ADD', n2.outputs['Fac'], 0.08, n1.outputs['Fac']), bm.inputs['Height'])
        ln(nt, bm.outputs[0], gl.inputs['Normal']); ln(nt, bm.outputs[0], lwf.inputs['Normal'])
        rg = nd(nt, 'ShaderNodeTexNoise', {'Scale': 0.35, 'Detail': 4.0}); ln(nt, tc.outputs['Object'], rg.inputs['Vector'])
        ln(nt, ramp(nt, rg.outputs['Fac'], [(0.45, (0.004, 0.004, 0.004, 1)), (0.7, (0.12, 0.12, 0.12, 1))]), gl.inputs['Roughness'])
    mx = nd(nt, 'ShaderNodeMixShader'); ln(nt, frv, mx.inputs[0]); ln(nt, tr.outputs[0], mx.inputs[1]); ln(nt, gl.outputs[0], mx.inputs[2])
    s = mx.outputs[0]
    if kind == 'top':   # 雪粉：顺风拖在雪垄后面的一道道薄粉；霜：贴着冰面的一层细白
        mp = nd(nt, 'ShaderNodeMapping', {'Scale': (0.25, 2.2, 1.0), 'Rotation': (0, 0, math.atan2(-0.28, 0.96))}); ln(nt, tc.outputs['Object'], mp.inputs['Vector'])
        dn = nd(nt, 'ShaderNodeTexNoise', {'Scale': 1.0, 'Detail': 6.0, 'Roughness': 0.6, 'Distortion': 0.4}); ln(nt, mp.outputs[0], dn.inputs['Vector'])
        fine = nd(nt, 'ShaderNodeTexNoise', {'Scale': 160.0, 'Detail': 4.0}); ln(nt, tc.outputs['Object'], fine.inputs['Vector'])
        dust = math_(nt, 'MULTIPLY', ramp(nt, dn.outputs['Fac'], [(0.63, (0, 0, 0, 1)), (0.74, (1, 1, 1, 1))]), ramp(nt, fine.outputs['Fac'], [(0.35, (0.15, 0.15, 0.15, 1)), (0.7, (1, 1, 1, 1))]))
        ps = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, tc.outputs['Object'], ps.inputs[0])
        rr = math_(nt, 'SQRT', math_(nt, 'ADD', math_(nt, 'MULTIPLY', ps.outputs['X'], ps.outputs['X']), math_(nt, 'MULTIPLY', ps.outputs['Y'], ps.outputs['Y'])))
        dust = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', dust, 0.45), ramp(nt, rr, [(2.0, (0, 0, 0, 1)), (5.0, (1, 1, 1, 1))]))
        fv = nd(nt, 'ShaderNodeTexVoronoi', {'Scale': 9.0, 'Randomness': 1.0}); ln(nt, tc.outputs['Object'], fv.inputs['Vector'])   # 霜花：一簇簇，1–4 厘米
        fs = nd(nt, 'ShaderNodeSeparateColor'); ln(nt, fv.outputs['Color'], fs.inputs[0])
        fn = nd(nt, 'ShaderNodeTexNoise', {'Scale': 400.0, 'Detail': 6.0, 'Roughness': 0.7}); ln(nt, tc.outputs['Object'], fn.inputs['Vector'])
        fl = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', math_(nt, 'LESS_THAN', fv.outputs['Distance'], math_(nt, 'MULTIPLY_ADD', fs.outputs[1], 0.25, 0.08)), math_(nt, 'GREATER_THAN', fs.outputs[0], 0.55)), ramp(nt, fn.outputs['Fac'], [(0.4, (0, 0, 0, 1)), (0.62, (1, 1, 1, 1))]))
        wd = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.85, 0.88, 0.95, 1), 'Roughness': 0.9, 'Subsurface Weight': 0.5, 'Subsurface Scale': 0.01})
        m2 = nd(nt, 'ShaderNodeMixShader'); ln(nt, dust, m2.inputs[0]); ln(nt, s, m2.inputs[1]); ln(nt, wd.outputs[0], m2.inputs[2]); s = m2.outputs[0]
    if kind == 'wall':   # 融开的断口：毛的、发白
        wd = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.8, 0.88, 0.95, 1), 'Roughness': 0.5, 'Transmission Weight': 0.6, 'IOR': 1.31})
        m2 = nd(nt, 'ShaderNodeMixShader', {'Fac': 0.06}); ln(nt, s, m2.inputs[1]); ln(nt, wd.outputs[0], m2.inputs[2]); s = m2.outputs[0]
    ln(nt, s, out.inputs['Surface']); return m


def m_bubble():
    """冻在冰里的甲烷气泡：扁的白饼，泡壁上结着霜，把照进冰里的月光散开：发白、不反光（不然像塑料珠子）；
    中间薄、透一点，边上一圈厚、更白；霜一块块不匀；冰下的光也透得过来"""
    m, nt = mat('bubble'); out = nd(nt, 'ShaderNodeOutputMaterial')
    df = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.93, 0.96, 0.99, 1), 'Roughness': 0.85, 'Specular IOR Level': 0.15})
    tl = nd(nt, 'ShaderNodeBsdfTranslucent', {'Color': (0.85, 0.9, 0.95, 1)})
    wh = nd(nt, 'ShaderNodeMixShader', {'Fac': 0.3}); ln(nt, df.outputs[0], wh.inputs[1]); ln(nt, tl.outputs[0], wh.inputs[2])
    tr = nd(nt, 'ShaderNodeBsdfTransparent')
    lw = nd(nt, 'ShaderNodeLayerWeight', {'Blend': 0.5})
    tc = nd(nt, 'ShaderNodeTexCoord'); ns = nd(nt, 'ShaderNodeTexNoise', {'Scale': 300.0, 'Detail': 4.0}); ln(nt, tc.outputs['Object'], ns.inputs['Vector'])
    a = math_(nt, 'ADD', math_(nt, 'MULTIPLY', math_(nt, 'POWER', lw.outputs['Facing'], 1.2), 0.6), math_(nt, 'MULTIPLY_ADD', ns.outputs['Fac'], 0.5, 0.05))
    a = math_(nt, 'MINIMUM', a, 0.95)
    mx = nd(nt, 'ShaderNodeMixShader'); ln(nt, a, mx.inputs[0]); ln(nt, tr.outputs[0], mx.inputs[1]); ln(nt, wh.outputs[0], mx.inputs[2])
    ln(nt, mx.outputs[0], out.inputs['Surface']); return m


def m_crack():
    """冰里裂开的一片：冰缝里是薄薄一层空气。斜着看过了临界角（49.7°）全反射，是一片白亮的镜面；正着看透过去。断面上有一道道羽毛纹"""
    m, nt = mat('crack'); out = nd(nt, 'ShaderNodeOutputMaterial')
    tc = nd(nt, 'ShaderNodeTexCoord'); uv = tc.outputs['UV']
    tr = nd(nt, 'ShaderNodeBsdfTransparent'); gl = nd(nt, 'ShaderNodeBsdfGlossy', {'Roughness': 0.2})
    lw = nd(nt, 'ShaderNodeLayerWeight', {'Blend': 0.5})
    tir = ramp(nt, lw.outputs['Facing'], [(0.30, (0.04, 0.04, 0.04, 1)), (0.40, (1, 1, 1, 1))])
    sep = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, uv, sep.inputs[0])
    mp = nd(nt, 'ShaderNodeMapping', {'Scale': (14.0, 3.0, 1.0), 'Rotation': (0, 0, 0.6)}); ln(nt, uv, mp.inputs['Vector'])
    fe = nd(nt, 'ShaderNodeTexWave', {'Scale': 6.0, 'Distortion': 3.0, 'Detail': 4.0}); ln(nt, mp.outputs[0], fe.inputs['Vector'])   # 羽毛纹
    fade = ramp(nt, sep.outputs['Y'], [(0.0, (1, 1, 1, 1)), (0.08, (0.3, 0.3, 0.3, 1)), (0.5, (0.06, 0.06, 0.06, 1)), (1.0, (0, 0, 0, 1))])   # 贴着冰面那一截最亮，越往下越淡
    k = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', tir, fade), ramp(nt, fe.outputs['Fac'], [(0.3, (0.1, 0.1, 0.1, 1)), (0.85, (1, 1, 1, 1))])), 0.4)
    wt = nd(nt, 'ShaderNodeBsdfDiffuse', {'Color': (0.85, 0.9, 0.95, 1)})
    m1 = nd(nt, 'ShaderNodeMixShader'); ln(nt, math_(nt, 'MULTIPLY', k, 0.15), m1.inputs[0]); ln(nt, tr.outputs[0], m1.inputs[1]); ln(nt, gl.outputs[0], m1.inputs[2])
    fade2 = ramp(nt, sep.outputs['Y'], [(0.0, (1, 1, 1, 1)), (0.03, (0.12, 0.12, 0.12, 1)), (0.15, (0, 0, 0, 1))])   # 白只在贴着冰面的那条线上，往下是透的（不然一整片灰板）
    k2 = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', ramp(nt, fe.outputs['Fac'], [(0.3, (0.3, 0.3, 0.3, 1)), (0.85, (1, 1, 1, 1))]), fade2), 0.6)
    m2 = nd(nt, 'ShaderNodeMixShader'); ln(nt, k2, m2.inputs[0]); ln(nt, m1.outputs[0], m2.inputs[1]); ln(nt, wt.outputs[0], m2.inputs[2])
    ln(nt, m2.outputs[0], out.inputs['Surface']); return m


def water_volume(nt, out, scatter=0.35):
    v = nd(nt, 'ShaderNodeVolumeAbsorption', {'Color': (0.35, 0.62, 0.66, 1), 'Density': 2.5})
    ln(nt, v.outputs[0], out.inputs['Volume'])


def m_water(kind):
    m, nt = mat('water_' + kind); out = nd(nt, 'ShaderNodeOutputMaterial'); water_volume(nt, out)
    if kind == 'side':
        ln(nt, nd(nt, 'ShaderNodeBsdfTransparent').outputs[0], out.inputs['Surface']); return m
    p = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (1, 1, 1, 1), 'Roughness': 0.0, 'Transmission Weight': 1.0, 'IOR': 1.33})
    tc = nd(nt, 'ShaderNodeTexCoord')
    n = nd(nt, 'ShaderNodeTexNoise', {'Scale': 9.0, 'Detail': 4.0, 'Roughness': 0.55}, noise_dimensions='4D'); ln(nt, tc.outputs['Object'], n.inputs['Vector'])
    m.node_tree['wt'] = n.name
    bm = nd(nt, 'ShaderNodeBump', {'Strength': 0.15, 'Distance': 0.01}); ln(nt, n.outputs['Fac'], bm.inputs['Height']); ln(nt, bm.outputs[0], p.inputs['Normal'])
    ln(nt, p.outputs[0], out.inputs['Surface']); return m


def m_ember():
    """火种：一截烧剩的木炭。炭黑、顺木纹一丝丝的，每块光泽不一样；灰白的灰挂在块面上和亮缝的边上；
    缝里透出红到橙黄的光（越深越烫）；一半的块面上还有更细的龟裂；还热的那一边，灰底下也透着暗红"""
    m, nt = mat('ember'); out = nd(nt, 'ShaderNodeOutputMaterial')
    at = lambda n: nd(nt, 'ShaderNodeAttribute', attribute_name=n)
    crk, rest, heat, ash, blk = at('crk'), at('rest'), at('heat'), at('ash'), at('blk')
    ei = nd(nt, 'ShaderNodeValue', label='ei'); ei.name = 'ei'; ei.outputs[0].default_value = 1.0
    mp = nd(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.06, 1.0, 1.0); ln(nt, rest.outputs['Vector'], mp.inputs['Vector'])
    fib = nd(nt, 'ShaderNodeTexNoise', {'Scale': 1400.0, 'Detail': 3.0}); ln(nt, mp.outputs[0], fib.inputs['Vector'])   # 顺木纹的丝：沿 x 拉长的噪声
    vo = nd(nt, 'ShaderNodeTexVoronoi', {'Scale': 160.0}, feature='DISTANCE_TO_EDGE'); ln(nt, rest.outputs['Vector'], vo.inputs['Vector'])
    fr = nd(nt, 'ShaderNodeMapRange', {'From Min': 0.0, 'From Max': 0.06, 'To Min': 1.0, 'To Max': 0.0}, interpolation_type='SMOOTHSTEP'); ln(nt, vo.outputs['Distance'], fr.inputs['Value'])
    fine = math_(nt, 'MULTIPLY', fr.outputs[0], math_(nt, 'GREATER_THAN', blk.outputs['Fac'], 0.4))
    char = ramp(nt, fib.outputs['Fac'], [(0.35, (0.011, 0.0105, 0.01, 1)), (0.65, (0.032, 0.03, 0.028, 1))])
    alb = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, ash.outputs['Fac'], alb.inputs['Factor']); ln(nt, char, alb.inputs['A']); alb.inputs['B'].default_value = (0.24, 0.235, 0.225, 1)
    alb2 = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, math_(nt, 'MULTIPLY', fine, 0.85), alb2.inputs['Factor']); ln(nt, alb.outputs['Result'], alb2.inputs['A']); alb2.inputs['B'].default_value = (0.004, 0.004, 0.004, 1)
    rc = math_(nt, 'MULTIPLY_ADD', blk.outputs['Fac'], 0.3, 0.16)                     # 炭面 0.16–0.46：有的块有丝光，有的哑
    rough = math_(nt, 'MULTIPLY_ADD', ash.outputs['Fac'], math_(nt, 'SUBTRACT', 0.95, rc), rc)
    hot = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', crk.outputs['Fac'], math_(nt, 'ADD', heat.outputs['Fac'], 0.3)), math_(nt, 'MINIMUM', ei.outputs[0], 1.5))
    T = math_(nt, 'MULTIPLY_ADD', math_(nt, 'MINIMUM', hot, 1.0), 850.0, 720.0)       # 快熄 700 K 暗红，烧旺了缝底 1250 K 橙黄；灰底下透的是暗红
    bb = nd(nt, 'ShaderNodeBlackbody'); ln(nt, T, bb.inputs[0])
    h = heat.outputs['Fac']
    es = math_(nt, 'ADD', math_(nt, 'MULTIPLY', math_(nt, 'POWER', crk.outputs['Fac'], 1.8), math_(nt, 'MULTIPLY_ADD', h, 8.0, 0.6)),
               math_(nt, 'MULTIPLY', h, math_(nt, 'ADD', math_(nt, 'MULTIPLY', fine, 0.6), math_(nt, 'MULTIPLY_ADD', ash.outputs['Fac'], 0.17, 0.08))))
    es = math_(nt, 'MULTIPLY', es, math_(nt, 'POWER', ei.outputs[0], 1.6))
    p = nd(nt, 'ShaderNodeBsdfPrincipled', {'Specular IOR Level': 0.5})
    ln(nt, alb2.outputs['Result'], p.inputs['Base Color']); ln(nt, rough, p.inputs['Roughness']); ln(nt, bb.outputs[0], p.inputs['Emission Color']); ln(nt, es, p.inputs['Emission Strength'])
    bm = nd(nt, 'ShaderNodeBump', {'Strength': 0.5, 'Distance': 0.0006}); ln(nt, math_(nt, 'MULTIPLY_ADD', fine, -0.6, math_(nt, 'MULTIPLY', fib.outputs['Fac'], 0.7)), bm.inputs['Height']); ln(nt, bm.outputs[0], p.inputs['Normal'])
    ln(nt, p.outputs[0], out.inputs['Surface']); return m


def m_terrain():
    """山：岩石（带岩层）、林地；冬天缓坡上全是雪（化雪的前沿 melt 从湖心往外推）"""
    m, nt = mat('terrain'); out = nd(nt, 'ShaderNodeOutputMaterial')
    tc = nd(nt, 'ShaderNodeTexCoord'); geo = nd(nt, 'ShaderNodeNewGeometry')
    a = nd(nt, 'ShaderNodeAttribute', attribute_name='a'); fo = nd(nt, 'ShaderNodeAttribute', attribute_name='fo')
    sep = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, geo.outputs['Normal'], sep.inputs[0])
    pos = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, tc.outputs['Object'], pos.inputs[0])
    st = nd(nt, 'ShaderNodeTexWave', {'Scale': 0.35, 'Distortion': 8.0, 'Detail': 6.0}, bands_direction='Z'); ln(nt, tc.outputs['Object'], st.inputs['Vector'])   # 岩层
    rn = nd(nt, 'ShaderNodeTexNoise', {'Scale': 0.6, 'Detail': 8.0, 'Roughness': 0.6}); ln(nt, tc.outputs['Object'], rn.inputs['Vector'])
    rock = ramp(nt, math_(nt, 'MULTIPLY_ADD', st.outputs['Fac'], 0.25, math_(nt, 'MULTIPLY', rn.outputs['Fac'], 0.8)), [(0.2, (0.035, 0.034, 0.033, 1)), (0.9, (0.13, 0.125, 0.12, 1))])
    sn = nd(nt, 'ShaderNodeTexNoise', {'Scale': 0.9, 'Detail': 5.0}); ln(nt, tc.outputs['Object'], sn.inputs['Vector'])
    snow = math_(nt, 'MULTIPLY', ramp(nt, math_(nt, 'MULTIPLY_ADD', sn.outputs['Fac'], 0.3, sep.outputs['Z']), [(0.48, (0, 0, 0, 1)), (0.58, (1, 1, 1, 1))]), 1.0)   # 60° 以内的坡都挂得住雪，只有峭壁露岩
    mel = nd(nt, 'ShaderNodeValue', label='melt'); mel.name = 'melt'; mel.outputs[0].default_value = -10.0
    r = math_(nt, 'SQRT', math_(nt, 'ADD', math_(nt, 'MULTIPLY', pos.outputs['X'], pos.outputs['X']), math_(nt, 'MULTIPLY', pos.outputs['Y'], pos.outputs['Y'])))
    keep = nd(nt, 'ShaderNodeMapRange', {'From Min': -8.0, 'From Max': 8.0}); ln(nt, math_(nt, 'SUBTRACT', r, mel.outputs[0]), keep.inputs['Value'])
    snow = math_(nt, 'MULTIPLY', snow, keep.outputs[0])
    floor = ramp(nt, rn.outputs['Fac'], [(0.3, (0.012, 0.016, 0.01, 1)), (0.7, (0.03, 0.028, 0.02, 1))])
    base = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, fo.outputs['Fac'], base.inputs['Factor']); ln(nt, rock, base.inputs['A']); ln(nt, floor, base.inputs['B'])
    wet = math_(nt, 'MULTIPLY', ramp(nt, pos.outputs['Z'], [(0.0, (0.35, 0.35, 0.35, 1)), (1.5, (1, 1, 1, 1))]), 1.0)
    pr = nd(nt, 'ShaderNodeBsdfPrincipled', {'Roughness': 0.85})
    c2 = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, base.outputs['Result'], c2.inputs['A']); ln(nt, wet, c2.inputs['B']); c2.blend_type = 'MULTIPLY'; c2.inputs['Factor'].default_value = 1.0
    ln(nt, c2.outputs['Result'], pr.inputs['Base Color'])
    sp = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.86, 0.9, 0.97, 1), 'Roughness': 0.75, 'Subsurface Weight': 1.0, 'Subsurface Radius': (0.8, 0.9, 1.0), 'Subsurface Scale': 0.05})
    bm = nd(nt, 'ShaderNodeBump', {'Strength': 0.5, 'Distance': 0.2}); ln(nt, rn.outputs['Fac'], bm.inputs['Height']); ln(nt, bm.outputs[0], pr.inputs['Normal']); ln(nt, bm.outputs[0], sp.inputs['Normal'])
    mx = nd(nt, 'ShaderNodeMixShader'); ln(nt, snow, mx.inputs[0]); ln(nt, pr.outputs[0], mx.inputs[1]); ln(nt, sp.outputs[0], mx.inputs[2])
    ln(nt, mx.outputs[0], out.inputs['Surface']); return m


def m_fir():
    """针叶：墨绿、透一点；朝上的面压着雪（化雪的前沿过去就没了）"""
    m, nt = mat('fir'); out = nd(nt, 'ShaderNodeOutputMaterial')
    geo = nd(nt, 'ShaderNodeNewGeometry'); tc = nd(nt, 'ShaderNodeTexCoord')
    sep = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, geo.outputs['Normal'], sep.inputs[0])
    n = nd(nt, 'ShaderNodeTexNoise', {'Scale': 6.0, 'Detail': 4.0}); ln(nt, tc.outputs['Object'], n.inputs['Vector'])
    nd_ = nd(nt, 'ShaderNodePrincipledBsdf' if False else 'ShaderNodeBsdfPrincipled', {'Base Color': (0.012, 0.024, 0.014, 1), 'Roughness': 0.6, 'Subsurface Weight': 0.0})
    tl = nd(nt, 'ShaderNodeBsdfTranslucent', {'Color': (0.01, 0.03, 0.01, 1)})
    needles = nd(nt, 'ShaderNodeMixShader', {'Fac': 0.25}); ln(nt, nd_.outputs[0], needles.inputs[1]); ln(nt, tl.outputs[0], needles.inputs[2])
    sp = nd(nt, 'ShaderNodeBsdfPrincipled', {'Base Color': (0.86, 0.9, 0.97, 1), 'Roughness': 0.8, 'Subsurface Weight': 1.0, 'Subsurface Scale': 0.03})
    snow = ramp(nt, math_(nt, 'MULTIPLY_ADD', n.outputs['Fac'], 0.5, sep.outputs['Z']), [(0.62, (0, 0, 0, 1)), (0.85, (1, 1, 1, 1))])
    oi = nd(nt, 'ShaderNodeObjectInfo')
    mel = nd(nt, 'ShaderNodeValue', label='melt'); mel.name = 'melt'; mel.outputs[0].default_value = -10.0
    ip = nd(nt, 'ShaderNodeAttribute', attribute_name='ipos', attribute_type='INSTANCER')
    sp2 = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, ip.outputs['Vector'], sp2.inputs[0])
    r = math_(nt, 'SQRT', math_(nt, 'ADD', math_(nt, 'MULTIPLY', sp2.outputs['X'], sp2.outputs['X']), math_(nt, 'MULTIPLY', sp2.outputs['Y'], sp2.outputs['Y'])))
    keep = nd(nt, 'ShaderNodeMapRange', {'From Min': -8.0, 'From Max': 8.0}); ln(nt, math_(nt, 'SUBTRACT', r, mel.outputs[0]), keep.inputs['Value'])
    mx = nd(nt, 'ShaderNodeMixShader'); ln(nt, math_(nt, 'MULTIPLY', snow, keep.outputs[0]), mx.inputs[0]); ln(nt, needles.outputs[0], mx.inputs[1]); ln(nt, sp.outputs[0], mx.inputs[2])
    ln(nt, mx.outputs[0], out.inputs['Surface']); return m


# ---------- 东西 ----------
def terrain(mt):
    N, R, k = 1601, 420.0, 2.62
    u = np.linspace(-1, 1, N); ax = R * np.sinh(k * u) / np.sinh(k)            # 湖边一格约 0.2 米，外圈约 1.4 米
    X, Y = np.meshgrid(ax, ax, indexing='ij')
    def calc():
        x3, z3 = X.ravel(), -Y.ravel(); h = land.height(x3, z3); a = land.lowf(x3, z3)
        sl = np.hypot(np.gradient(h.reshape(N, N), ax, axis=0), np.gradient(h.reshape(N, N), ax, axis=1)).ravel()
        return {'h': h, 'a': a, 'fo': land.forest(h, a, sl)}
    d = cached('terrain', calc); h, a, fo = d['h'], d['a'], d['fo']
    V = np.stack([X.ravel(), Y.ravel(), h], 1)
    ob = mesh_obj('terrain', V, grid_faces(N, N), [mt])
    attr(ob, 'a', a); attr(ob, 'fo', fo)
    return ob


def fir_mesh(rng, name, mt):
    """一棵云杉：高 1、冠底半径 1。细树干；一层层轮生的枝往下垂，枝是一片片带锯齿边的针叶簇，越往上越短"""
    V, F = [], []
    def add(vs, fs):
        o = sum(len(v) for v in V); V.append(np.asarray(vs)); F.extend([[i + o for i in f] for f in fs])
    s = 8; ang = np.linspace(0, 2 * np.pi, s, endpoint=False)
    tv = [[0.045 * (1 - z) * math.cos(a), 0.045 * (1 - z) * math.sin(a), z] for z in (0.0, 1.0) for a in ang]
    add(tv, [[i, (i + 1) % s, s + (i + 1) % s, s + i] for i in range(s)])
    nt = int(rng.integers(12, 17))
    for t in range(nt):
        z0 = 0.10 + 0.86 * (t + rng.uniform(-0.25, 0.25)) / nt
        L0 = (1 - z0) ** 0.9 * rng.uniform(0.85, 1.1)
        kb = int(rng.integers(6, 9)); a0 = rng.uniform(0, 2 * np.pi)
        for b in range(kb):
            a = a0 + 2 * np.pi * b / kb + rng.uniform(-0.25, 0.25); L = L0 * rng.uniform(0.75, 1.05); w = 0.32 * L + 0.04
            ca, sa = math.cos(a), math.sin(a); ns = 7; vs = []; fs = []
            for i in range(ns + 1):
                q = i / ns; r = 0.03 + L * q; z = z0 - 0.22 * L * q * q + 0.04 * L * q; hw = w * (0.35 + 0.65 * math.sin(math.pi * min(q * 1.15, 1.0))) * (1 - 0.7 * q * q)
                jag = 0.35 if i % 2 else 0.0                                    # 针叶簇的锯齿边
                for sd in (-1, 1):
                    e = hw * (1 + jag * sd * 0.5)
                    vs.append([r * ca - sd * e * sa, r * sa + sd * e * ca, z - 0.10 * e * abs(sd) * (1 - q)])
                vs.append([r * ca, r * sa, z + 0.04 * L * (1 - q)])             # 中脊略高，侧面往下耷
            for i in range(ns):
                p = 3 * i; fs += [[p, p + 2, p + 5, p + 3], [p + 2, p + 1, p + 4, p + 5]]
            add(vs, fs)
    V = np.concatenate(V); F = np.asarray(F)
    return mesh_obj(name, V, F, [mt], coll=None)


def trees(mt, coll):
    rng = np.random.default_rng(31)
    proto = []
    for k in range(8):
        ob = fir_mesh(rng, f'fir{k}', mt); bpy.context.scene.collection.objects.unlink(ob); coll.objects.link(ob); proto.append(ob)
    T = land.trees(320.0)
    P = np.stack([T[:, 0], -T[:, 1], T[:, 2] - 0.15], 1)
    pts = mesh_obj('tree_pts', P, np.zeros((0, 3), np.int32))
    attr(pts, 'H', T[:, 3] * (0.8 + 0.4 * np.modf(T[:, 5] * 0.191)[0])); attr(pts, 'Rc', 0.95 * (0.7 + 0.6 * np.modf(T[:, 5] * 0.37)[0]))   # 大小参差，树冠挨着
    attr(pts, 'var', np.floor(np.modf(T[:, 5] * 0.0071)[0] * 8)); attr(pts, 'rot', np.modf(T[:, 5] * 0.013)[0] * 6.283)
    ng = bpy.data.node_groups.new('trees', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    gi, go = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
    ci = ng.nodes.new('GeometryNodeCollectionInfo'); ci.inputs['Collection'].default_value = coll; ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    ip = ng.nodes.new('GeometryNodeInstanceOnPoints'); ip.inputs['Pick Instance'].default_value = True
    def na(n, t='FLOAT'):
        x = ng.nodes.new('GeometryNodeInputNamedAttribute'); x.data_type = t; x.inputs['Name'].default_value = n; return x.outputs['Attribute']
    cx = ng.nodes.new('ShaderNodeCombineXYZ'); ng.links.new(na('Rc'), cx.inputs['X']); ng.links.new(na('Rc'), cx.inputs['Y']); ng.links.new(na('H'), cx.inputs['Z'])
    cr = ng.nodes.new('ShaderNodeCombineXYZ'); ng.links.new(na('rot'), cr.inputs['Z'])
    m2p = ng.nodes.new('GeometryNodeMeshToPoints')
    sa = ng.nodes.new('GeometryNodeStoreNamedAttribute'); sa.data_type = 'FLOAT_VECTOR'; sa.domain = 'INSTANCE'; sa.inputs['Name'].default_value = 'ipos'
    pos = ng.nodes.new('GeometryNodeInputPosition')
    ng.links.new(gi.outputs[0], m2p.inputs['Mesh']); ng.links.new(m2p.outputs[0], ip.inputs['Points']); ng.links.new(ci.outputs[0], ip.inputs['Instance'])
    ng.links.new(na('var'), ip.inputs['Instance Index']); ng.links.new(cx.outputs[0], ip.inputs['Scale']); ng.links.new(cr.outputs[0], ip.inputs['Rotation'])
    ng.links.new(ip.outputs[0], sa.inputs['Geometry']); ng.links.new(pos.outputs[0], sa.inputs['Value']); ng.links.new(sa.outputs[0], go.inputs[0])
    md = pts.modifiers.new('trees', 'NODES'); md.node_group = ng
    coll.hide_render = True
    return pts


def ring_noise(th, seed, amp):
    """冰洞边：沿着一圈的不规整（只跟角度有关，洞张大时形状跟着放大）"""
    c, s = np.cos(th), np.sin(th)
    return 1 + amp * (fbm(c * 1.3 + 4.0, s * 1.3 + 4.0, seed, 4) - 0.5) * 2 + 0.08 * (fbm(c * 5 + 9, s * 5 + 9, seed + 5, 3) - 0.5) * 2


def ice(mats):
    """冰：一整块环形的板（外圈 400 米压在山下面），内圈就是冰洞。洞的大小用形变键 open（值 = 半径 / 40 米），
    洞壁下半截往外掏一点（暖水从下面化得多），水线以上 3 cm 是白的断口，水下是看不太出来的冰壁"""
    NR, NT, Ro = 420, 1440, 400.0
    th = np.linspace(0, 2 * np.pi, NT, endpoint=False); u = np.linspace(0, 1, NR) ** 2
    rn = ring_noise(th, 7, 0.22)
    def ring(z, under):
        r0 = np.outer(Ro * u, np.ones(NT))                                  # 洞半径为 0 时
        r1 = np.outer(Ro * u + (1 - u), rn * (1.06 if under else 1.0)) * 40.0 - np.outer(Ro * u, np.ones(NT)) * 39.0 + np.outer(Ro * u, np.ones(NT)) * 0
        r1 = np.outer(Ro * u, np.ones(NT)) + np.outer((1 - u), rn * (1.06 if under else 1.0)) * 40.0
        b = np.stack([r0 * np.cos(th), r0 * np.sin(th), np.full(r0.shape, z)], -1).reshape(-1, 3)
        k = np.stack([r1 * np.cos(th), r1 * np.sin(th), np.full(r1.shape, z)], -1).reshape(-1, 3)
        return b, k
    def quads(off, flip):
        i, j = np.meshgrid(np.arange(NR - 1), np.arange(NT), indexing='ij'); j1 = (j + 1) % NT
        a, b, c, d = off + i * NT + j, off + (i + 1) * NT + j, off + (i + 1) * NT + j1, off + i * NT + j1
        q = np.stack([a, b, c, d], -1).reshape(-1, 4); return q[:, ::-1] if flip else q
    tb, tk = ring(TOP, False); bb, bk = ring(BOT, True)
    # 洞壁：冰面那圈（TOP）→ 水线（z = 0，半径介于两者之间）→ 冰底那圈（BOT）
    mid_b = np.stack([np.zeros(NT), np.zeros(NT), np.zeros(NT)], 1); mid_k = np.stack([rn * 40 * np.cos(th), rn * 40 * np.sin(th), np.zeros(NT)], 1)   # 水面以上的壁是直的，只有水下被暖水往外掏
    Vb = np.concatenate([tb, bb, mid_b]); Vk = np.concatenate([tk, bk, mid_k])
    nT = NR * NT; o_mid = 2 * nT
    j = np.arange(NT); j1 = (j + 1) % NT
    wall_air = np.stack([j, j1, o_mid + j1, o_mid + j], -1)                   # 冰面圈 → 水线圈
    wall_wet = np.stack([o_mid + j, o_mid + j1, nT + j1, nT + j], -1)          # 水线圈 → 冰底圈
    F = np.concatenate([quads(0, False), quads(nT, True), wall_air, wall_wet])
    fi = np.concatenate([np.zeros(len(quads(0, False))), np.ones(len(quads(0, False))), np.full(NT, 2), np.full(NT, 3)])
    ob = mesh_obj('ice', Vb, F, mats, fi)
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='open'); k.data.foreach_set('co', Vk.astype(np.float32).ravel()); k.slider_max = 10.0
    return ob


def water(mats):
    """冰洞里的水：顶面是水面（z = 0），侧面、底面只是装水的体积；洞多大跟冰一样走形变键 open。下面一整块是湖水"""
    NR, NT = 40, 1440
    th = np.linspace(0, 2 * np.pi, NT, endpoint=False); rn = ring_noise(th, 7, 0.22) * 1.06 * 1.001
    u = np.linspace(0, 1, NR)
    def disc(z, s):
        r = np.outer(u, rn) * 40.0 * s
        return np.stack([r * np.cos(th), r * np.sin(th), np.full(r.shape, z)], -1).reshape(-1, 3)
    Vk = np.concatenate([disc(-0.0005, 1.0 / 1.06), disc(BOT - 0.001, 1.0)]); Vb = Vk * np.array([0, 0, 1])
    i, j = np.meshgrid(np.arange(NR - 1), np.arange(NT), indexing='ij'); j1 = (j + 1) % NT; n = NR * NT
    top = np.stack([i * NT + j, (i + 1) * NT + j, (i + 1) * NT + j1, i * NT + j1], -1).reshape(-1, 4)
    bot = (top + n)[:, ::-1]; e = (NR - 1) * NT; jj = np.arange(NT); jj1 = (jj + 1) % NT
    side = np.stack([e + jj1, e + jj, n + e + jj, n + e + jj1], -1)
    F = np.concatenate([top, bot, side]); fi = np.concatenate([np.zeros(len(top)), np.ones(len(bot) + len(side))])
    ob = mesh_obj('hole_water', Vb, F, mats[:2], fi)
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='open'); k.data.foreach_set('co', Vk.astype(np.float32).ravel()); k.slider_max = 10.0
    # 冰下的湖水：一整块体积（冰底以下）
    s = 120.0
    V = np.array([[-s, -s, -6], [s, -s, -6], [s, s, -6], [-s, s, -6], [-s, -s, BOT - 0.001], [s, -s, BOT - 0.001], [s, s, BOT - 0.001], [-s, s, BOT - 0.001]])
    F = np.array([[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
    mesh_obj('lake_water', V, F, [mats[2]], smooth=False)
    return ob


def cut_group():
    """冰洞张开时，洞里的气泡、裂纹、雪一起没了：删掉离湖心 R 以内的"""
    ng = bpy.data.node_groups.new('cut', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry'); s = ng.interface.new_socket('R', in_out='INPUT', socket_type='NodeSocketFloat')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    gi, go = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
    r, Rj = jag(ng, ng.nodes.new('GeometryNodeInputPosition').outputs[0], gi.outputs['R'])
    lt = ng.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; ng.links.new(r, lt.inputs[0]); ng.links.new(Rj, lt.inputs[1])
    dg = ng.nodes.new('GeometryNodeDeleteGeometry'); dg.domain = 'POINT'
    ng.links.new(gi.outputs[0], dg.inputs['Geometry']); ng.links.new(lt.outputs[0], dg.inputs['Selection']); ng.links.new(dg.outputs[0], go.inputs[0])
    return ng


def add_cut(ob, ng):
    md = ob.modifiers.new('cut', 'NODES'); md.node_group = ng
    sid = next(i.identifier for i in ng.interface.items_tree if getattr(i, 'name', '') == 'R' and i.in_out == 'INPUT')
    getattr(md.properties.inputs, sid).value = 0.0
    return md, sid


def ellipsoids(C, R3, ang, seg=28, rings=12, e=1.0):
    """一批扁椭球（气泡）拼成一个网格；e < 1 是顶和底平、边上圆的饼"""
    th = np.linspace(0, 2 * np.pi, seg, endpoint=False); ph = np.linspace(0, np.pi, rings + 1)   # 两极每段一个点（重合），全是四边形，不会被清理掉
    sp = lambda v: np.sign(v) * np.abs(v) ** e
    unit = np.stack([np.outer(sp(np.sin(ph)), np.cos(th)).ravel(), np.outer(sp(np.sin(ph)), np.sin(th)).ravel(), np.repeat(sp(np.cos(ph)), seg)], 1)
    nv = len(unit); i, j = np.meshgrid(np.arange(rings), np.arange(seg), indexing='ij'); j1 = (j + 1) % seg
    F = np.stack([i * seg + j, i * seg + j1, (i + 1) * seg + j1, (i + 1) * seg + j], -1).reshape(-1, 4)
    ca, sa = np.cos(ang)[:, None], np.sin(ang)[:, None]
    P = unit[None] * R3[:, None, :]
    x, y = P[..., 0] * ca - P[..., 1] * sa, P[..., 0] * sa + P[..., 1] * ca
    V = np.stack([x, y, P[..., 2]], -1) + C[:, None, :]
    FF = (F[None] + (np.arange(len(C)) * nv)[:, None, None]).reshape(-1, 4)
    return V.reshape(-1, 3), FF


def bubbles(mt, hb):
    """甲烷气泡：一柱一柱，扁的白圆片一层层往下叠（越往下越小、越稀），柱子略歪；火种周围密，外面稀，一片一片的"""
    rng = np.random.default_rng(11); C, R3, A = [], [], []
    def column(x, y, big):
        n = int(rng.integers(2, 8)); d = 0.012 + 0.06 * rng.random(); rb = (0.004 + 0.032 * rng.random() ** 2.5) * big
        tx, ty = rng.normal(0, 0.12, 2)
        for k in range(n):
            if d > TOP - BOT - 0.03: break
            r = rb * rng.lognormal(0.0, 0.45) * (1 - 0.55 * d / (TOP - BOT))
            if rng.random() < 0.25: r *= 0.3                                       # 有的层只冒一小颗
            C.append([x + tx * d + rng.normal(0, 0.18 * r), y + ty * d + rng.normal(0, 0.18 * r), TOP - d]); R3.append([r, r * rng.uniform(0.75, 1.0), r * rng.uniform(0.06, 0.14)]); A.append(rng.uniform(0, 6.283))
            d += max(0.006, rng.lognormal(-3.6, 0.6))
    patch = lambda x, y: sm(0.42, 0.62, fbm(x * 0.35 + 3, y * 0.35 + 3, 77, 3))
    for _ in range(6000):                                                       # 火种周围 14 米
        r, a = 14 * math.sqrt(rng.random()), rng.uniform(0, 6.283); x, y = r * math.cos(a), r * math.sin(a)
        if rng.random() < 0.35 * max(float(patch(np.array([x]), np.array([y]))[0]), 0.5 * (1 - r / 3.5)) * (1.6 - r / 14): column(x, y, 1.0 + 0.8 * max(0.0, 1 - r / 3.0))
    for _ in range(30):                                                         # bar5–6 镜头贴着冰面看的那一片（火种上方偏南）
        r, a = rng.uniform(0.14, 0.75), rng.uniform(-2.6, -0.5); column(r * math.cos(a), r * math.sin(a), 0.8)
    for _ in range(4000):                                                       # 外圈稀
        r, a = rng.uniform(14, 60), rng.uniform(0, 6.283); x, y = r * math.cos(a), r * math.sin(a)
        if rng.random() < 0.35 * float(patch(np.array([x]), np.array([y]))[0]): column(x, y, 1.3)
    for _ in range(160):                                                        # 细的一串串小气泡（只在近处）
        r, a = 3.5 * math.sqrt(rng.random()), rng.uniform(0, 6.283); x, y = r * math.cos(a), r * math.sin(a)
        d0 = rng.uniform(0.01, 0.1); n = int(rng.integers(5, 18))
        for k in range(n):
            rr = rng.uniform(0.0008, 0.0025); C.append([x + rng.normal(0, 0.0015), y + rng.normal(0, 0.0015), TOP - d0 - k * rng.uniform(0.004, 0.012)]); R3.append([rr, rr, rr * 0.9]); A.append(0.0)
    for _ in range(90):                                                         # bar5–7 镜头贴着冰面拍的那一小块（10–20 厘米高往下看）：密，一层层；接月亮那颗周围 7 厘米留空
        r, a = abs(rng.normal(0, 0.3)), rng.uniform(0, 6.283); x, y = 0.15 + r * math.cos(a), 0.04 + r * math.sin(a)   # 往外慢慢变稀，看不出边
        if math.hypot(x - hb[0], y + hb[1]) > 0.07: column(x, y, rng.uniform(0.3, 0.8))
    # bar6→7 那颗圆气泡（接月亮）：正圆，白，边上一圈亮
    C.append([hb[0], -hb[1], TOP - hb[2]]); R3.append([hb[3], hb[3], hb[3] * 0.22]); A.append(0.0)
    C, R3, A = np.asarray(C), np.asarray(R3), np.asarray(A)
    n = 9000; r, a = np.abs(rng.normal(0, 0.25, n)), rng.uniform(0, 6.283, n)       # 同一块里悬着的细小气泡（0.2–0.8 毫米），给近景层次
    cs = np.stack([0.15 + r * np.cos(a), 0.04 + r * np.sin(a), TOP - 0.004 - rng.uniform(0, TOP - BOT - 0.01, n) ** 1.0], 1)
    cs = cs[np.hypot(cs[:, 0] - hb[0], cs[:, 1] + hb[1]) > 0.03]; rs = rng.uniform(0.0002, 0.0008, len(cs))
    V2, F2 = ellipsoids(cs, np.stack([rs, rs, rs * 0.8], 1), np.zeros(len(cs)), seg=8, rings=4)
    keep = np.hypot(C[:, 0], C[:, 1]) > 0.05
    V, F = ellipsoids(C[keep], R3[keep], A[keep], e=0.35)
    V, F = np.concatenate([V, V2]), np.concatenate([F, F2 + len(V)])
    log('气泡', int(keep.sum()))
    return mesh_obj('bubbles', V, F, [mt])


def cracks(mt):
    """冰缝：一片片往下裂开的面。长的几条横穿湖面（几十米，微微弯）；火种周围放射状裂开几道；沿着它们分出短叉；近处一些细的"""
    rng = np.random.default_rng(23); V, F, UV = [], [], []
    def walk(x, y, hd, L, step, curl):
        pts = [(x, y)]; k = 0.0
        for i in range(int(L / step)):
            k = 0.97 * k + rng.normal(0, curl); hd += k * step + (rng.normal(0, 0.35) if rng.random() < 0.04 else 0.0)   # 偶尔折一下
            x, y = x + step * math.cos(hd), y + step * math.sin(hd); pts.append((x, y))
        return np.asarray(pts)
    def sheet(P, D0, step):
        n = len(P); s = np.arange(n) * step
        d = D0 * (0.55 + 0.45 * fbm(s * 0.8 + rng.uniform(0, 99), np.zeros(n) + 3.3, 51, 3) * 1.6).clip(0.3, 1.2)
        d *= np.minimum(1, np.minimum(s, s[-1] - s) / (0.5 + 3 * D0) + 0.25)           # 两头浅
        tilt = 0.9 * (fbm(s * 0.15 + rng.uniform(0, 99), np.zeros(n), 52, 2) - 0.5) * 2    # 裂面歪着
        T = np.gradient(P, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9; N = np.stack([-T[:, 1], T[:, 0]], 1)
        jz = np.stack([fbm(s * 9 + rng.uniform(0, 99), np.zeros(n), 53, 2) - 0.5, fbm(s * 9 + rng.uniform(0, 99), np.ones(n), 54, 2) - 0.5], 1) * 0.008   # 细碎的折（平滑的）
        top = np.concatenate([P + jz, np.full((n, 1), TOP - 0.004)], 1)
        bot = np.concatenate([P + jz + N * (tilt * d)[:, None], (TOP - 0.004 - d)[:, None]], 1)
        o = sum(len(v) for v in V); V.append(np.concatenate([top, bot]))
        i = np.arange(n - 1); F.append(np.stack([o + i, o + i + 1, o + n + i + 1, o + n + i], 1))
        UV.append(np.concatenate([np.stack([s, np.zeros(n)], 1), np.stack([s, np.ones(n)], 1)]))
        return P
    mains = []
    for _ in range(9):
        a = rng.uniform(0, 6.283); r = rng.uniform(5, 35); x, y = r * math.cos(a), r * math.sin(a)
        P = walk(x, y, rng.uniform(0, 6.283), rng.uniform(25, 75), 0.05, 0.004); mains.append(sheet(P, rng.uniform(0.06, 0.15), 0.05))
    for k in range(5):
        a = 2 * np.pi * k / 5 + rng.uniform(-0.4, 0.4)
        P = walk(0.28 * math.cos(a), 0.28 * math.sin(a), a, rng.uniform(1.5, 4.0), 0.015, 0.22); mains.append(sheet(P, rng.uniform(0.05, 0.14), 0.015))
    for _ in range(70):
        P0 = mains[rng.integers(len(mains))]; q = P0[rng.integers(len(P0))]; t = P0[-1] - P0[0]; base = math.atan2(t[1], t[0])
        sheet(walk(q[0], q[1], base + rng.choice([-1, 1]) * rng.uniform(0.5, 1.4), rng.uniform(0.3, 4.0), 0.015, 0.05), rng.uniform(0.03, 0.09), 0.015)
    for _ in range(160):
        r, a = 3.5 * math.sqrt(rng.random()), rng.uniform(0, 6.283)
        sheet(walk(r * math.cos(a), r * math.sin(a), rng.uniform(0, 6.283), rng.uniform(0.08, 0.6), 0.006, 0.15), rng.uniform(0.015, 0.07), 0.006)
    V = np.concatenate(V); F = np.concatenate(F); UV = np.concatenate(UV)
    ob = mesh_obj('cracks', V, F, [mt], smooth=True)
    uvl = ob.data.uv_layers.new(name='UVMap'); uvl.data.foreach_set('uv', UV[F.ravel()].astype(np.float32).ravel())
    log('裂纹面', len(F))
    return ob


def snow_on_ice(mt):
    """冰面上的雪：三层网格（火种周围 ±7 米 1.4 厘米一格，±25 米 4 厘米，±75 米 12 厘米），高度按 snow_f；没雪的地方沉进冰里"""
    obs = []
    for name, R, d, inner in (('snow_a', 7.0, 0.014, 0.0), ('snow_b', 25.0, 0.04, 7.0), ('snow_c', 75.0, 0.12, 25.0)):
        n = int(round(2 * R / d)) + 1; ax = np.linspace(-R, R, n); X, Y = np.meshgrid(ax, ax, indexing='ij'); x, y = X.ravel(), Y.ravel()
        f = cached(name, lambda: {'f': snow_f(x, y)})['f']; z = snow_z(f)
        Fq = grid_faces(n, n); cx, cy = x[Fq].mean(1), y[Fq].mean(1)
        keep = (np.maximum(abs(cx), abs(cy)) >= inner) & (f[Fq].max(1) > 0) & (np.hypot(cx, cy) < 72)
        Fq = Fq[keep]; used = np.unique(Fq); remap = np.full(len(x), -1); remap[used] = np.arange(len(used))
        V = np.stack([x[used], y[used], z[used]], 1); ob = mesh_obj(name, V, remap[Fq], [mt]); obs.append(ob)
        log(name, len(used), '点')
    return obs


def hu(a, b, s):
    """两个整数编号 → [0, 1) 的随机数"""
    return (land.h3(land.ivec(a), land.ivec(b), np.full(a.shape, s, np.uint32)) >> np.uint32(8)).astype(np.float64) / 16777216.0


def voro3(P, cell, seed):
    """3D 沃罗诺伊（抖动格子，一格一个点）：到最近两点中垂面的距离（米）、最近和次近那格的编号"""
    Q = P / cell; base = np.floor(Q); n = len(Q)
    d1, d2 = np.full(n, 1e9), np.full(n, 1e9); S1, S2 = np.zeros_like(Q), np.zeros_like(Q); i1, i2 = np.zeros(n, np.int64), np.zeros(n, np.int64)
    for o in np.ndindex(3, 3, 3):
        C = base + np.array(o) - 1; u = [land.ivec(C[:, k] + 512) for k in range(3)]
        S = C + np.stack([(land.h3(u[0], u[1] + np.uint32(7919 * k), u[2] + np.uint32(seed)) >> np.uint32(8)) / 16777216.0 for k in range(3)], 1)
        ci = ((C[:, 0] + 512) * 1048576 + (C[:, 1] + 512) * 1024 + C[:, 2] + 512).astype(np.int64)
        d = ((Q - S) ** 2).sum(1); a, b = d < d1, (d >= d1) & (d < d2)
        d2 = np.where(a, d1, np.where(b, d, d2)); S2 = np.where(a[:, None], S1, np.where(b[:, None], S, S2)); i2 = np.where(a, i1, np.where(b, ci, i2))
        d1 = np.where(a, d, d1); S1 = np.where(a[:, None], S, S1); i1 = np.where(a, ci, i1)
    return ((Q - (S1 + S2) / 2) * (S1 - S2)).sum(1) / np.linalg.norm(S1 - S2, axis=1) * cell, i1, i2


def ember_obj(mt):
    """火种：一截烧剩的木炭（顺木纹是 x 向，约 32×20×24 厘米），棱角烧圆、崩掉几块。
    表面龟裂成大小不一、鼓起来的炭块（3D 沃罗诺伊，约 2 厘米一块）；每道缝宽窄深浅各不一样，宽的多半还透着光，细的是死缝"""
    bpy.ops.mesh.primitive_cube_add(size=2.0)
    ob = bpy.context.active_object; ob.name = 'ember'
    sd = ob.modifiers.new('sd', 'SUBSURF'); sd.subdivision_type = 'SIMPLE'; sd.levels = sd.render_levels = 9   # 一格约 0.6 毫米，缝壁上才有几排顶点
    bpy.ops.object.modifier_apply(modifier='sd')
    me = ob.data; n = len(me.vertices); Q = np.zeros(n * 3, np.float32); me.vertices.foreach_get('co', Q); Q = Q.reshape(-1, 3).astype(np.float64)
    D = Q / np.linalg.norm(Q, axis=1, keepdims=True); A = np.array([0.16, 0.115, 0.095])
    lo, hi = np.zeros(n), np.full(n, 0.3)
    for _ in range(30):                                                          # 超椭球：顺木纹两头平一点（指数 5），截面圆一点（指数 2.4）
        m = (lo + hi) / 2; X = D * m[:, None] / A; g = np.abs(X[:, 0]) ** 5 + (np.abs(X[:, 1]) ** 2.4 + np.abs(X[:, 2]) ** 2.4) ** (5 / 2.4) - 1
        lo, hi = np.where(g < 0, m, lo), np.where(g < 0, hi, m)
    P = D * ((lo + hi) / 2)[:, None]
    for nrm, dd in (((0.15, 0.25, 0.96), 0.072), ((0.93, -0.3, 0.2), 0.135), ((-0.9, 0.35, -0.25), 0.14)):
        nrm = np.asarray(nrm) / np.linalg.norm(nrm); sd = P @ nrm - dd; P -= np.maximum(sd, 0)[:, None] * nrm[None]   # 劈开的一面、两头的断口
    me.vertices.foreach_set('co', P.astype(np.float32).ravel()); me.update()
    N = np.zeros(n * 3, np.float32); me.vertex_normals.foreach_get('vector', N); N = N.reshape(-1, 3).astype(np.float64)
    disp = 0.008 * (fbm(P[:, 0] * 7 + P[:, 2] * 3, P[:, 1] * 7 - P[:, 2] * 5, 61, 3) - 0.5) + 0.0025 * (fbm(P[:, 0] * 40 + P[:, 2] * 17, P[:, 1] * 40, 62, 2) - 0.5) \
        + 0.012 * (fbm(P[:, 0] * 3 + 1, P[:, 1] * 3 + P[:, 2] * 2, 60, 2) - 0.5)
    x, phi, rad = P[:, 0], np.arctan2(P[:, 2], P[:, 1]), np.hypot(P[:, 1], P[:, 2])
    W = P + 0.005 * (np.stack([fbm(P[:, 1] * 40 + P[:, 0] * 11, P[:, 2] * 40, 81, 3), fbm(P[:, 2] * 40 + 3.7, P[:, 0] * 40, 82, 3),
                               fbm(P[:, 0] * 40 + 7.1, P[:, 1] * 40 + P[:, 2] * 9, 83, 3)], 1) - 0.5)   # 缝走得弯弯折折
    de, i1, i2 = voro3(W * (0.8, 1.15, 1.15), 0.02, 5)   # 顺木纹略长
    a, b = np.minimum(i1, i2), np.maximum(i1, i2); r1, r2, r3 = hu(a, b, 91), hu(a, b, 92), hu(a, b, 93)
    w = np.where(r3 < 0.15, 0.0004, 0.0008 + 0.003 * r1 ** 2)                  # 缝宽 0.8–3.8 毫米，多数细；一成多的边没裂开，只是一道浅印
    g = np.clip(1 - de / w, 0, 1)                                                # 缝里：缝底 1，缝沿 0
    off = -(0.0015 + 2.2 * w) * g ** 1.2 - 0.0012 * (1 - sm(0, w + 0.006, de))   # 宽缝也深；块的边烧圆了，块面鼓起来
    live = (r2 < 0.05 + 0.45 * r1) * (r3 >= 0.15)                               # 三成的缝还透光，宽的多
    glow = 0.1 + 0.9 * sm(0.4, 0.75, fbm(x * 55 + phi * 3, phi * 9 + rad * 35, 78, 3))   # 沿着缝时明时暗
    P = P + N * (disp + off)[:, None]
    me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    heat = sm(0.45, 0.75, fbm(P[:, 0] * 7 + 2, P[:, 1] * 7 + P[:, 2] * 5, 63, 3))   # 只有一边还热
    crk = g * live * glow
    rim = (1 - sm(w, w + 0.004, de)) * live * heat                               # 亮缝的边上挂着灰
    ash = np.clip(sm(0.48, 0.66, fbm(P[:, 0] * 26 + P[:, 2] * 9, P[:, 1] * 26 - P[:, 2] * 7, 64, 4)) * (0.35 + 0.65 * sm(0.0, 0.8, N[:, 2])) + 0.9 * rim, 0, 1) * (1 - g) ** 3
    attr(ob, 'crk', crk); attr(ob, 'rest', P, 'FLOAT_VECTOR'); attr(ob, 'heat', heat); attr(ob, 'ash', ash); attr(ob, 'blk', hu(i1, np.zeros_like(i1), 94))
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    me.materials.append(mt)
    return ob


def moon(md):
    """月亮：NASA 的月面贴图（公有领域，blender/assets/moon_2k.jpg），正面朝着湖；比真的大一倍（视半径 0.01 弧度），和着色器版本一样"""
    m, nt = mat('moon'); out = nd(nt, 'ShaderNodeOutputMaterial')
    tx = nd(nt, 'ShaderNodeTexImage'); tx.image = bpy.data.images.load(str(HERE / 'assets' / 'moon_2k.jpg')); tx.image.colorspace_settings.name = 'sRGB'
    em = nd(nt, 'ShaderNodeEmission', {'Strength': 2.6}); em.name = 'moonE'; ln(nt, tx.outputs[0], em.inputs[0]); ln(nt, em.outputs[0], out.inputs['Surface'])
    D = 40000.0; R = D * math.tan(0.01)   # 40 公里：长焦机位离湖心几十米，4 公里时视差有 0.4°，bar7 月亮对不上那颗气泡
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=R, location=tuple(md * D))
    ob = bpy.context.active_object; ob.name = 'moon'; ob.data.materials.append(m)
    for p in ob.data.polygons: p.use_smooth = True
    # 经度 0（正面）对着湖：球的 -x 朝湖心
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = Vector((-1, 0, 0)).rotation_difference(-md) if False else (-md).to_track_quat('-X', 'Z')
    ob.visible_shadow = False; ob.visible_diffuse = False; ob.visible_glossy = True
    return ob


def world(md):
    w = bpy.data.worlds.new('night'); bpy.context.scene.world = w
    try: w.use_nodes = True
    except Exception: pass
    nt = w.node_tree; nt.nodes.clear(); out = nd(nt, 'ShaderNodeOutputWorld')
    tc = nd(nt, 'ShaderNodeTexCoord'); dirv = tc.outputs['Generated']
    sep = nd(nt, 'ShaderNodeSeparateXYZ'); ln(nt, dirv, sep.inputs[0])
    y = math_(nt, 'MAXIMUM', sep.outputs['Z'], 0.0)
    md_ = vmath(nt, 'DOT_PRODUCT', dirv, tuple(md)); mdv = math_(nt, 'MAXIMUM', md_.outputs['Value'], 0.0)
    hor = nd(nt, 'ShaderNodeMix', data_type='RGBA'); hor.inputs['A'].default_value = (0.018, 0.025, 0.05, 1); hor.inputs['B'].default_value = (0.0025, 0.0035, 0.011, 1)
    ln(nt, math_(nt, 'POWER', y, 0.4), hor.inputs['Factor'])
    mi = nd(nt, 'ShaderNodeValue', label='moonI'); mi.name = 'moonI'; mi.outputs[0].default_value = 1.0   # 跟月盘一起按 track 的 moon 压暗（bar7 防闪）
    glow = math_(nt, 'MULTIPLY', math_(nt, 'ADD', math_(nt, 'MULTIPLY', math_(nt, 'POWER', mdv, 3000.0), 0.9), math_(nt, 'MULTIPLY', math_(nt, 'POWER', mdv, 20.0), 0.08)), mi.outputs[0])   # 月晕 1–2°，外圈淡；原来整个长焦画面都在月晕里，天是亮灰的
    gc = nd(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='ADD'); gc.inputs['Factor'].default_value = 1.0; ln(nt, hor.outputs['Result'], gc.inputs['A'])
    gcol = nd(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY'); gcol.inputs['Factor'].default_value = 1.0; gcol.inputs['A'].default_value = (0.10, 0.12, 0.20, 1); ln(nt, glow, gcol.inputs['B'])
    ln(nt, gcol.outputs['Result'], gc.inputs['B'])
    # 星：细的点，云缝里
    vo = nd(nt, 'ShaderNodeTexVoronoi', {'Scale': 260.0}); ln(nt, dirv, vo.inputs['Vector'])
    sv = nd(nt, 'ShaderNodeSeparateColor'); ln(nt, vo.outputs['Color'], sv.inputs[0])
    star = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', math_(nt, 'GREATER_THAN', sv.outputs[0], 0.985), math_(nt, 'LESS_THAN', vo.outputs['Distance'], 0.07)), math_(nt, 'MULTIPLY', ramp(nt, sep.outputs['Z'], [(0.02, (0, 0, 0, 1)), (0.2, (1, 1, 1, 1))]), 0.6))
    cl = nd(nt, 'ShaderNodeTexNoise', {'Scale': 2.2, 'Detail': 6.0, 'Roughness': 0.55}); ln(nt, dirv, cl.inputs['Vector'])
    cov = ramp(nt, cl.outputs['Fac'], [(0.45, (0, 0, 0, 1)), (0.68, (1, 1, 1, 1))])
    star = math_(nt, 'MULTIPLY', star, math_(nt, 'SUBTRACT', 1.0, cov))
    sc_ = nd(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='ADD'); sc_.inputs['Factor'].default_value = 1.0; ln(nt, gc.outputs['Result'], sc_.inputs['A'])
    stc = nd(nt, 'ShaderNodeCombineColor'); [ln(nt, math_(nt, 'MULTIPLY', star, k), stc.inputs[i]) for i, k in enumerate((0.9, 0.95, 1.1))]
    ln(nt, stc.outputs[0], sc_.inputs['B'])
    # 薄云：月光透过来，靠月亮那边亮
    cc = nd(nt, 'ShaderNodeMix', data_type='RGBA'); cc.inputs['A'].default_value = (0.006, 0.008, 0.017, 1); cc.inputs['B'].default_value = (0.05, 0.06, 0.09, 1)
    ln(nt, math_(nt, 'POWER', mdv, 4.0), cc.inputs['Factor'])
    fin = nd(nt, 'ShaderNodeMix', data_type='RGBA'); ln(nt, math_(nt, 'MULTIPLY', cov, ramp(nt, sep.outputs['Z'], [(0.0, (0, 0, 0, 1)), (0.1, (1, 1, 1, 1))])), fin.inputs['Factor']); ln(nt, sc_.outputs['Result'], fin.inputs['A']); ln(nt, cc.outputs['Result'], fin.inputs['B'])
    bg = nd(nt, 'ShaderNodeBackground', {'Strength': 1.0}); ln(nt, fin.outputs['Result'], bg.inputs[0]); ln(nt, bg.outputs[0], out.inputs['Surface'])
    # 月光：太阳灯，从月亮那边斜照下来（方位 287°、仰角 26.5°）
    ld = bpy.data.lights.new('moonlight', 'SUN'); ld.energy = 1.35; ld.color = (0.58, 0.68, 1.0); ld.angle = math.radians(1.15)
    lo = bpy.data.objects.new('moonlight', ld); bpy.context.scene.collection.objects.link(lo)
    lo.rotation_mode = 'QUATERNION'; lo.rotation_quaternion = (-md).to_track_quat('-Z', 'Y')


def look_quat(p, l, up):
    f = (l - p).normalized(); r = f.cross(up).normalized(); u = r.cross(f)
    return Matrix((r, u, -f)).transposed().to_quaternion()


def camera(tr, name='cam', key='cam'):
    cd = bpy.data.cameras.new(name); cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24.0; cd.clip_start = 0.005; cd.clip_end = 60000.0
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 5.6
    ob = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(ob); ob.rotation_mode = 'QUATERNION'
    F = [x for x in tr['frames'] if x.get(key)]
    fr = [x['f'] for x in F]; loc, rot, fov, foc = [], [], [], []; q0 = None
    for x in F:
        c = x[key]; p, l, up = B(c['p']), B(c['l']), B(c['up']); q = look_quat(p, l, up)
        if q0 is not None and q.dot(q0) < 0: q.negate()
        q0 = q; loc.append(tuple(p)); rot.append(tuple(q)); fov.append(math.radians(c['fov'])); f = (l - p).normalized()
        foc.append(min((l - p).length, (p.z - (TOP - 0.08)) / -f.z) if f.z < -0.2 and p.z < 3.0 else (l - p).length)   # 贴着冰面往下看：对在冰层里
    fkeys(ob, 'location', fr, loc); fkeys(ob, 'rotation_quaternion', fr, rot)
    fkeys(cd, 'lens', fr, [12.0 / math.tan(v / 2) for v in fov]); fkeys(cd.dof, 'focus_distance', fr, foc)   # 竖直视角换成焦距（底片高 24 毫米）
    return ob


def build(job):
    t0 = time.time(); sc = bpy.context.scene
    tr = json.loads((HERE / 'track.json').read_text(encoding='utf-8'))
    md = B(tr['moon']).normalized()
    sc.render.engine = 'CYCLES'
    sc.cycles.max_bounces, sc.cycles.transmission_bounces, sc.cycles.transparent_max_bounces, sc.cycles.glossy_bounces, sc.cycles.diffuse_bounces, sc.cycles.volume_bounces = 12, 12, 16, 4, 2, 2   # 白汽、雪雾要多次散射才白
    sc.cycles.adaptive_threshold = 0.02; sc.render.use_persistent_data = True
    sc.cycles.caustics_reflective = True; sc.cycles.caustics_refractive = False; sc.cycles.blur_glossy = 0.5
    sc.cycles.sample_clamp_indirect = 4.0   # 体积多了以后雪面、冰面上有绿色、白色的萤火点
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = 1.0   # 整首都用 Blender，不用再对 bar17 着色器的 ACES；原来 None、0.8 偏灰
    world(md); moon(md); log('天、月亮')
    terrain(m_terrain()); log('山')
    tc = bpy.data.collections.new('fir_protos'); sc.collection.children.link(tc); trees(m_fir(), tc); log('树')
    ice_ob = ice([m_ice('ice_top', 'top'), m_ice('ice_bot', 'bot'), m_ice('ice_wall', 'wall'), m_ice('ice_wet', 'wwet')]); log('冰')
    wat = water([m_water('surf'), m_water('side'), (lambda: (lambda m, nt: (water_volume(nt, nd(nt, 'ShaderNodeOutputMaterial')), m)[1])(*mat('lake')))()]); log('水')
    ng = cut_group(); cuts = []
    hb = tr['frames'][round(tr['BB'][7] * 60) - 30]['hb']
    for ob in (bubbles(m_bubble(), hb), cracks(m_crack()), *snow_on_ice(m_snow())): cuts.append(add_cut(ob, ng) + (ob,))
    log('气泡、裂纹、雪')
    em = ember_obj(m_ember()); em.rotation_mode = 'QUATERNION'; log('火种')
    # 逐帧：冰洞、火种的位置和自转、亮度
    F = tr['frames']; fr = [x['f'] for x in F]; T1 = tr['T1']
    op = np.array([max(x['open'], 0.0) for x in F])
    for k in (ice_ob, wat): fkeys(k.data.shape_keys.key_blocks['open'], 'value', fr, op / 40.0)
    cutR = op * 1.25 + np.where(op > 0, 0.06, 0.0)
    for md_, sid, ob in cuts: fkeys(getattr(md_.properties.inputs, sid), 'value', fr, cutR)
    fkeys(bpy.data.materials['snow'].node_tree.nodes['cutR'].outputs[0], 'default_value', fr, cutR)
    ax = Vector((0.15, -0.1, 1.0)).normalized()
    fkeys(em, 'location', fr, [tuple(B(x['e'])) for x in F])
    qs = []; q0 = None
    for x in F:
        q = Quaternion(ax, 0.12 * (x['tw'] - T1))
        if q0 is not None and q.dot(q0) < 0: q.negate()
        q0 = q; qs.append(tuple(q))
    fkeys(em, 'rotation_quaternion', fr, qs)
    fkeys(em.data.materials[0].node_tree.nodes['ei'].outputs[0], 'default_value', fr, [x['ei'] for x in F])
    mv = [x['moon'] for x in F]; fkeys(bpy.data.materials['moon'].node_tree.nodes['moonE'].inputs['Strength'], 'default_value', fr, [2.6 * v for v in mv])
    fkeys(bpy.context.scene.world.node_tree.nodes['moonI'].outputs[0], 'default_value', fr, mv)
    melt = np.array([(-10.0 if x['open'] < 2 else x['open']) for x in F])
    for m in (bpy.data.materials['terrain'], bpy.data.materials['fir']): fkeys(m.node_tree.nodes['melt'].outputs[0], 'default_value', fr, melt)
    cam = camera(tr); sc.camera = cam; log('相机')
    # bar6→7 E：冰里那台（cam_w_ice）、拉开看月亮那台（cam_w_moon）各渲一份，scene.js 在 bar7 前后 0.05 秒叠化（track.json 在 bar7 ±0.3 秒给了两条路径 cw、cl）
    B7 = tr['BB'][7]
    for x in F:
        x['c_ice'] = x.get('cw') or (x['cam'] if x['tw'] < B7 else None)
        x['c_moon'] = x.get('cl') or (x['cam'] if x['tw'] >= B7 else None)
    camera(tr, 'cam_w_ice', 'c_ice'); camera(tr, 'cam_w_moon', 'c_moon')
    # 会动的小东西（fx.py）：时间都用变速后的世界时间
    import fx
    BBs = tr['BB']; tw = np.array([x['tw'] for x in F])
    fl = fx.m_flake()
    ob, md, g = fx.snowfall(fl, cam, TOP); fkeys(g.key(md, 't'), 'value', fr, tw); fkeys(g.key(md, 'dens'), 'value', fr, 1 - sm(BBs[11], BBs[13], tw))
    ob, md, g = fx.spiral_snow(fl, BBs[9]); fkeys(g.key(md, 't'), 'value', fr, tw)
    mist = fx.volume_box('swirl_mist', (11.0, 11.0, 6.0), fx.m_swirlmist)   # 比旋臂大，不然被盒子边切出一道直边; mist.location = (0, 0, TOP)
    mn = mist.data.materials[0].node_tree.nodes; fkeys(mn['t'].outputs[0], 'default_value', fr, tw)
    fkeys(mn['dens'].outputs[0], 'default_value', fr, sm(BBs[9] - 0.9, BBs[9] - 0.3, tw) * (1 - sm(BBs[9] + 1.2, BBs[9] + 2.6, tw)))
    kin = sm(BBs[13] - 0.3, BBs[14], tw)
    ob, md, g = fx.sparks(fx.m_spark()); fkeys(g.key(md, 't'), 'value', fr, tw); fkeys(g.key(md, 'dim'), 'value', fr, kin)
    fkeys(g.key(md, 'E'), 'value', fr, [tuple(B(x['e'])) for x in F])
    pl = fx.volume_box('plume', (3.0, 3.0, 3.6), fx.m_plume); fkeys(pl, 'location', fr, [tuple(B(x['e'])) for x in F])
    pn = pl.data.materials[0].node_tree.nodes; fkeys(pn['t'].outputs[0], 'default_value', fr, tw); fkeys(pn['smoke'].outputs[0], 'default_value', fr, [x['smoke'] for x in F])
    st = fx.volume_box('steam', (1.0, 1.0, 1.0), fx.m_steam)   # bar12→13 F：从冰洞里冒起一团白汽，横着从镜头前飘过
    u = tw - (BBs[13] - 1.05); sz = 0.6 + 0.4 * np.clip(u, 0, 3)
    # 中心离镜头 0.9 米（x = 1.5），横着往 -y 飘，bar13 那一拍正好挡在镜头和火种之间（出图对过：比连线算的高 0.2 米、晚 0.12 秒）
    fkeys(st, 'location', fr, np.stack([np.full_like(u, 1.5), 0.475 + 1.45 * (1.17 - u), 0.8 + 0.15 * (u - 1.17) - sz * 0.5], 1)); fkeys(st, 'scale', fr, np.stack([sz * 1.6, sz * 1.3, sz], 1))
    sn_ = st.data.materials[0].node_tree.nodes; fkeys(sn_['t'].outputs[0], 'default_value', fr, tw); fkeys(sn_['dens'].outputs[0], 'default_value', fr, sm(0.0, 0.4, u) * (1 - sm(1.6, 2.7, u)))
    log('雪、雪旋、火星屑、烟、白汽')
    sc.cycles.samples = 256
    if os.environ.get('JZ_FAST'): sc.cycles.samples = 48; sc.render.resolution_percentage = 50
    for n in filter(None, os.environ.get('JZ_HIDE', '').split(',')): bpy.data.objects[n].hide_render = True   # 调试：临时藏掉某些东西
    if os.environ.get('JZ_RES'): sc.render.resolution_percentage = int(os.environ['JZ_RES'])
    log(f'建好，{time.time() - t0:.0f}s')
