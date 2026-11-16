# blender/build.py —— 人物层：用户的两个 VRM（她、他）和他们拿着、碰到的东西，背景透明，叠到 Canvas 画面上（scene.js 的 people()）。
# 相机、位置、姿势不在这里定：scene.js 每个镜头把它们记下来，track.py 导成 blender/track.json，这里只管照着摆。
# 不打关键帧：每次换帧（含运动模糊的子帧）按「当前相机是哪个镜头」从 track 取值摆好，所以同一帧永远是同一个姿势。
# 坐标：scene.js 的世界 (x 右, y 上, z 沿路往前) = Blender 的 (x, z, y)。人物自己的坐标：x 是他的左手边，-y 是面朝的方向，z 向上。
import json, math, sys
from pathlib import Path
import bpy, bmesh, addon_utils
from mathutils import Matrix, Quaternion, Vector

SRC = {'her': '老婆/老婆-学生3.vrm', 'him': '我/我-学生1.vrm'}   # 在仓库外的 ../建模/，只读
D = math.radians
AX = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}
def R(ax, deg): return Quaternion(AX[ax], D(deg))
def clamp(x, a, b): return a if x < a else b if x > b else x
def hsh(i, s): x = math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - math.floor(x)

def mixv(a, b, k):   # 两份 track 之间插值：数字线性插，别的（名字）取近的那份
    if isinstance(a, dict) and isinstance(b, dict): return {q: mixv(v, b[q], k) if q in b else v for q, v in a.items()}
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b): return [mixv(x, y, k) for x, y in zip(a, b)]
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool): return a + (b - a) * k
    return a if k < 0.5 else b

def sample(tr, f):
    F = tr['frames']; u = clamp((f - tr['f0']) / tr['step'], 0, len(F) - 1); i = int(u)
    return mixv(F[i], F[min(i + 1, len(F) - 1)], u - i)

# 表情：scene.js 里写左边的名字（或直接写 VRoid 的 Fcl_ 形态键名），0..1
FACE = {'happy': 'Fcl_ALL_Joy', 'fun': 'Fcl_ALL_Fun', 'sad': 'Fcl_ALL_Sorrow', 'surprised': 'Fcl_ALL_Surprised', 'angry': 'Fcl_ALL_Angry',
        'blink': 'Fcl_EYE_Close', 'smile': 'Fcl_MTH_Fun', 'aa': 'Fcl_MTH_A', 'oh': 'Fcl_MTH_O'}
# 挂在骨头上的点，给手去够：scene.js 里写 handL: ['him.chestL', 权重]。偏移是静止姿势下相对骨头根部的（人物自己的坐标）
ANCHORS = {'chestL': ('chest', (0.10, -0.08, 0.0)), 'chestR': ('chest', (-0.10, -0.08, -0.03)), 'nape': ('head', (-0.07, 0.085, 0.10)),
           'cheekL': ('head', (0.05, -0.09, 0.05)), 'cheekR': ('head', (-0.05, -0.09, 0.05)), 'mouth': ('head', (-0.02, -0.12, 0.0)),
           'handL': ('left_hand', (0.06, 0, -0.02)), 'handR': ('right_hand', (-0.06, 0, -0.02)),
           'kneeL': ('left_lower_leg', (0, -0.07, 0.04)), 'kneeR': ('right_lower_leg', (0, -0.07, 0.04)),
           # 牵手：对方的手腕落在这只手的手腕旁、掌心那一侧（两只手掌心贴掌心）；tip 在指尖外（面对面拉手）
           'holdL': ('left_hand', (0.02, 0, -0.035)), 'holdR': ('right_hand', (-0.02, 0, -0.035)), 'tipL': ('left_hand', (0.14, 0, -0.03)), 'tipR': ('right_hand', (-0.14, 0, -0.03)),
           # 拥抱：手落在对方背上（肩胛）和后腰
           'backL': ('chest', (0.08, 0.10, 0.08)), 'backR': ('chest', (-0.08, 0.10, 0.08)), 'waistL': ('spine', (0.09, 0.10, 0.03)), 'waistR': ('spine', (-0.09, 0.10, 0.03))}
ANCH = {}

def load(who, path):
    sc = bpy.context.scene; before = set(bpy.data.objects); bpy.ops.import_scene.vrm(filepath=str(path))
    new = set(bpy.data.objects) - before; arm = next(o for o in new if o.type == 'ARMATURE'); arm.name = who   # 名字给网页预览的代理找
    hb = arm.data.vrm_addon_extension.vrm1.humanoid.human_bones
    name = {k: getattr(hb, k).node.bone_name for k in dir(hb) if not k.startswith('_') and hasattr(getattr(hb, k), 'node') and getattr(hb, k).node.bone_name}
    arm.rotation_mode = "XYZ"   # glTF 导进来是四元数，yaw 用欧拉角
    for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
    face = next(o for o in new if o.type == 'MESH' and o.data.shape_keys and 'Fcl_ALL_Joy' in o.data.shape_keys.key_blocks).data.shape_keys.key_blocks
    a = {'arm': arm, 'objs': list(new), 'pb': {k: arm.pose.bones[n] for k, n in name.items()}, 'rest': {k: arm.data.bones[n].matrix_local.to_quaternion() for k, n in name.items()},
         'face': face, 'fcl': [k.name for k in face if k.name.startswith('Fcl_')], 'hipz': arm.data.bones[name['hips']].head_local.z, 'headz': arm.data.bones[name['head']].head_local.z + 0.07, 'ik': {},
         'sec': [(b, arm.data.bones[b.name].matrix_local.to_quaternion(), hsh(i, 7) * 6.28) for i, b in enumerate(arm.pose.bones) if 'J_Sec_' in b.name and 'Bust' not in b.name]}   # 头发、裙摆的小骨头
    for sd in ('left', 'right'):   # 手去够一个点：小臂上挂 IK（大臂、小臂两节），平时权重 0
        c = a['pb'][sd + '_lower_arm'].constraints.new('IK'); c.chain_count = 2; c.influence = 0; a['ik'][sd] = c
    for nm, (bone, off) in ANCHORS.items():
        b = arm.data.bones[name[bone]]; e = bpy.data.objects.new(f'{who}.{nm}', None); sc.collection.objects.link(e)
        e.parent, e.parent_type, e.parent_bone = arm, 'BONE', b.name
        e.location = (b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted() @ (b.head_local + Vector(off)); ANCH[e.name] = e
    return a

def look_at(a, P, where):   # 为了看那个地方，头要转多少 [左转, 低头]（度，已乘 lookW）
    T = where(P.get('look'))
    if T is None: return [0.0, 0.0]
    d = T - Vector((P['x'], P['z'], P.get('y', 0) + a['headz'] - P.get('sit', 0) * (a['hipz'] - 0.17))); w = P.get('lookW', 1)
    return [-clamp((math.degrees(math.atan2(d.x, d.y)) - P.get('yaw', 0) + 180) % 360 - 180, -80, 80) * w, -clamp(math.degrees(math.atan2(d.z, math.hypot(d.x, d.y))), -40, 40) * w]

# 动作滤波：scene.js 给的姿势是按歌词时刻写的，直接照摆会一下子动起来。上身每一项都取「过去一小段」的加权平均（核 u·e^-u：慢起、慢收），
# 身体平均晚 0.18 秒，头再晚一点（头跟在身体后面）。只跟时间有关，不靠上一帧。脚下的位置、朝向、步子不滤：影子和手里的东西在 Canvas 里按没滤的画。
LAG_D = list(range(0, 61, 2))   # 往回看 1 秒，每 2 帧一份
def _ker(tau): w = [d / (tau * 60) * math.exp(-d / (tau * 60)) for d in LAG_D]; w[0] = w[1] * 0.25; n = sum(w); return [x / n for x in w]
LAG_BODY, LAG_HEAD = _ker(0.09), _ker(0.15)
ARM0 = [82, 3, 14]
def smooth_pose(a, tr, f, who, where_at):
    cur = sample(tr, f).get(who)
    if not cur or cur.get('hide', 0) > 0.5: return cur
    acc = {}; name = {}
    def add(k, v, w):
        if isinstance(v, list): acc[k] = [x + w * y for x, y in zip(acc.get(k, [0.0] * len(v)), v)]
        else: acc[k] = acc.get(k, 0.0) + w * v
    for i, d in enumerate(LAG_D):
        S = sample(tr, f - d); P = S.get(who) or cur; g = P.get; wb, wh = LAG_BODY[i], LAG_HEAD[i]
        for k in ('bend', 'side', 'twist', 'wristL', 'wristR', 'gripL', 'gripR', 'calmL', 'calmR', 'turnL', 'turnR'): add(k, g(k, 0.0), wb)
        for k in ('armL', 'armR'): add(k, g(k, ARM0), wb)
        add('head', g('head', [0, 0, 0]), wh); add('_look', look_at(a, P, where_at(S)), wh)
        for sd in 'LR':
            H = g('hand' + sd)
            if H and sd not in name: name[sd] = H[0]   # 够哪个点：用最近一次写了的
            add('_h' + sd, H[1] if H else 0.0, wb)
        for k, v in (g('face') or {}).items(): add('face.' + k, v, wh)   # 表情跟头一样慢（晚约 0.3 秒）
    out = {k: v for k, v in cur.items() if k in ('x', 'y', 'z', 'yaw', 'walk', 'gait', 'sit', 'hide')}
    out.update({k: v for k, v in acc.items() if not k.startswith(('face.', '_h'))})
    out['face'] = {k[5:]: v for k, v in acc.items() if k.startswith('face.')}
    for sd in 'LR':
        if sd in name: out['hand' + sd] = [name[sd], acc['_h' + sd]]
    return out

def pose(a, P, t, seed, where, flow):
    """P 是 scene.js 给这个人的一帧：x z y 脚下的位置，yaw 面朝哪（度：0 背对镜头沿路往前，90 朝画面右，180 朝镜头），
    walk 走了几个步态周期 / gait 迈步幅度 0..1，sit 坐在地上 0..1，bend / side / twist 上身前倾 / 侧倾 / 扭（度），
    armL armR [放下多少, 往前摆, 屈肘]（度），turnL turnR 前臂转（度：正 = 垂着手时掌心朝前，负 = 朝后），handL handR [够哪个点, 权重]，wristL wristR 手腕往拇指那边勾（度；牵手时掌心朝后的手正值、掌心朝前的手负值才是往自己身上勾），gripL gripR 握拳 0..1，calmL calmR 这只手不跟着步子甩 0..1，
    look 看谁（'her' 'him' 'cam' 或 [x, y, z]）/ lookW，head [左转, 低头, 歪头] 再加的角度，face {表情: 0..1}，hide 不出场。"""
    hide = not P or P.get('hide', 0) > 0.5
    for o in a['objs']: o.hide_render = hide
    if hide: return
    g = lambda k, d=0.0: P.get(k, d)
    arm, pb, rest = a['arm'], a['pb'], a['rest']
    yaw, ph, gait, sit = g('yaw'), 2 * math.pi * g('walk'), g('gait'), g('sit'); sw, cw = math.sin(ph), math.cos(ph)
    arm.location = (P['x'], P['z'], g('y')); arm.rotation_euler = (0, 0, math.pi - D(yaw))
    for b in pb.values(): b.rotation_quaternion = (1, 0, 0, 0)
    def rot(k, q):   # q 是在人物自己的坐标轴里说的转动（相对父骨头）
        if k in pb: r = rest[k]; pb[k].rotation_quaternion = r.inverted() @ q @ r
    bend, drop = g('bend') + 3 * gait + 14 * sit, 0.03 * gait * sw * sw + sit * (a['hipz'] - 0.17)
    pb['hips'].location = rest['hips'].inverted() @ Vector((0, 0, -drop))
    rot('hips', R('z', 4 * gait * sw) @ R('x', 0.3 * bend - 14 * sit))
    for k in ('spine', 'chest'):
        rot(k, R('z', g('twist') / 2 - 2.5 * gait * sw) @ R('y', g('side') / 2) @ R('x', 0.35 * bend + 10 * sit + (0.6 * math.sin(t * 1.5 + seed) if k == 'chest' else 0)))
    for sd, s in (('left', 1), ('right', -1)):
        L = sd[0].upper(); th, swing = s * sw, max(0.0, s * cw)   # 这条腿往前摆了多少、是不是正在往前迈
        thigh, knee = -24 * gait * th - 125 * sit, gait * (5 + 45 * swing ** 1.5) + 81 * sit
        rot(sd + '_upper_leg', R('y', -s * 7 * sit) @ R('x', thigh)); rot(sd + '_lower_leg', R('x', knee)); rot(sd + '_foot', R('x', -(thigh + knee) * sit + 10 * gait * th))
        A = g('arm' + L, [82, 3, 14]); down, fwd, el = A[0] - 12 * sit, A[1] - 20 * gait * th * (1 - g('calm' + L)) + 40 * sit, A[2] + 10 * gait + 35 * sit
        rot(sd + '_upper_arm', R('x', -fwd) @ R('y', s * down)); tw = g('turn' + L); rot(sd + '_lower_arm', R('z', -s * el) @ R('x', -0.6 * tw)); rot(sd + '_hand', R('z', -s * g('wrist' + L)) @ R('x', -0.4 * tw))
        curl = 16 + 60 * g('grip' + L)
        for fg in ('index', 'middle', 'ring', 'little'):
            for seg in ('proximal', 'intermediate', 'distal'): rot(f'{sd}_{fg}_{seg}', R('y', s * curl))
        rot(sd + '_thumb_metacarpal', R('z', s * 35 * min(1, 2 * g('grip' + L))))   # 握着时拇指收到食指边上，不往外翘
        H = P.get('hand' + L); tgt = ANCH.get(H[0]) if H else None; c = a['ik'][sd]
        if c.target is not tgt: c.target = tgt
        c.influence = clamp(H[1], 0, 1) if tgt else 0
    hy, hp, hr = g('head', [0, 0, 0]); la = P.get('_look') or look_at(a, P, where)
    hy += la[0]; hp += la[1]
    rot('neck', R('z', hy * 0.4) @ R('x', hp * 0.4)); rot('head', R('z', hy * 0.6) @ R('x', hp * 0.6) @ R('y', hr))
    # 头发、裙摆：不做模拟（模拟要靠上一帧），只按「风 - 自己的速度」往下风处偏一点，再加一点自己晃
    fx, fz = math.sin(D(yaw)), math.cos(D(yaw)); dx, dy = -flow[0] * fz + flow[1] * fx, -(flow[0] * fx + flow[1] * fz); sp = math.hypot(dx, dy)
    for b, r, phs in a['sec']:
        q = Quaternion((dy, -dx, 0), D(min(5 * sp, 11))) if sp > 1e-4 else Quaternion()
        b.rotation_quaternion = r.inverted() @ (q @ R('x', 1.3 * math.sin(t * 1.4 + phs))) @ r
    kb, F = a['face'], P.get('face', {})
    for k in a['fcl']: kb[k].value = 0
    for k, v in F.items(): kb[FACE.get(k, k)].value = clamp(v, 0, 1)
    u = t / 3.4 + seed * 0.37; i = math.floor(u); bl = max(0, 1 - abs((u - i) - 0.25 - 0.5 * hsh(i, seed)) * 3.4 / 0.09)   # 自己眨眼：约 3.4 秒一次
    kb['Fcl_EYE_Close'].value = max(kb['Fcl_EYE_Close'].value, bl * (1 - clamp(F.get('happy', 0) + F.get('fun', 0), 0, 1)))

def lin(h): return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 if c > 10 else c / 255 / 12.92 for c in bytes.fromhex(h.lstrip('#')))   # '#rrggbb' → 线性色
TOON = []   # (乘底色的节点, 底色)：夜里把底色压暗
GLB = False   # 在导出网页预览的代理（blender.py glb）：房子的材质只给底色，发光、照片、明暗由 scene.js 按材质名字接

def mat(name, col, emit=None):   # 房子的材质：卡通着色，受光只分亮、暗两档（EEVEE 的 Shader to RGB）；emit 给了就是自己发光的面（窗、灯），返回 (材质, 发光节点)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    if GLB: p = nt.nodes['Principled BSDF']; p.inputs['Base Color'].default_value = (*lin(col), 1); p.inputs['Roughness'].default_value = 1; return m if emit is None else (m, None)
    nt.nodes.clear(); N, L = nt.nodes.new, nt.links.new
    e = N('ShaderNodeEmission'); L(e.outputs[0], N('ShaderNodeOutputMaterial').inputs[0])
    if emit is not None: e.inputs[0].default_value = (*lin(col), 1); e.inputs[1].default_value = emit; return m, e
    r = N('ShaderNodeValToRGB'); cr = r.color_ramp; cr.interpolation = 'CONSTANT'; cr.elements[0].color = (*lin('#9a94b8'), 1); cr.elements[1].position = 0.3; cr.elements[1].color = (1, 1, 1, 1)
    mul = N('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = lin(col); TOON.append((mul, lin(col))); s = N('ShaderNodeShaderToRGB')
    L(N('ShaderNodeBsdfDiffuse').outputs[0], s.inputs[0]); L(s.outputs[0], r.inputs[0]); L(r.outputs[0], mul.inputs[0]); L(mul.outputs[0], e.inputs[0]); return m

def house(sc):
    """路尽头的家（scene.js 的 home 镜头）：方盒加人字屋顶，和人物同一遍渲——人挡房子、门灯和门里的光打在人身上、屋檐的影子都是真的。
    尺寸照 scene.js 的 chHouse（没渲过时的平面占位）。房子自己的坐标：x 右，-y 朝镜头（正面墙在 y = 0），z 上。
    scene.js 每帧给 house: { x, z 正面墙在哪, win 窗和灯亮了多少, door 门开了多少, night 夜色多重, ph 大窗里的照片 }；这一帧没给就不出场。"""
    root = bpy.data.objects.new('house', None); sc.collection.objects.link(root); O = [root]
    def prism(name, pts, y0, y1, m, parent=root):   # 截面 pts（x, z）沿进深 y0..y1 拉出来的一块
        n = len(pts); me = bpy.data.meshes.new(name)
        me.from_pydata([(x, y, z) for y in (y0, y1) for x, z in pts], [], [list(range(n)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)])
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        me.materials.append(m); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.parent = parent; O.append(o); return o
    def box(name, x0, x1, y0, y1, z0, z1, m, parent=root): return prism(name, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, m, parent)
    def light(name, kind, loc, col):
        o = bpy.data.objects.new(name, bpy.data.lights.new(name, kind)); sc.collection.objects.link(o); o.parent = root; o.location = loc; o.data.color = col; O.append(o); return o
    wall, foot, roof, wood, trim, brick = (mat(n, c) for n, c in (('wall', '#f1dcc0'), ('foot', '#c9a88a'), ('roof', '#c45a48'), ('wood', '#7a4a32'), ('trim', '#fbf3e6'), ('brick', '#8a4a3c')))
    (glass, gE), (lamp, lE), (inside, iE) = mat('glass', '#33405e', 1), mat('lamp', '#ffd38a', 0), mat('inside', '#ffcf8a', 0)
    DEP = 5.0   # 进深
    prism('walls', [(-3.1, 0), (3.1, 0), (3.1, 3.6), (0, 5.9), (-3.1, 3.6)], 0, DEP, wall); box('foot', -3.16, 3.16, -0.06, DEP, 0, 0.5, foot)
    for s in (-1, 1): prism('roof', [(s * 3.9, 3.05), (0, 5.95), (0, 6.22), (s * 3.9, 3.32)], -0.7, DEP + 0.3, roof)   # 屋檐往前挑 0.7 米：影子落在墙上
    box('chimney', 2.1, 2.75, 1.4, 2.05, 4.0, 6.3, brick); box('chimneyTop', 2.03, 2.82, 1.33, 2.12, 6.3, 6.42, foot)
    box('step', -1.15, 1.15, -0.7, 0, 0, 0.16, foot); box('canopy', -1.05, 1.05, -0.8, 0, 2.5, 2.62, roof)   # 门廊：台阶、雨棚、两根柱子
    for s in (-1, 1): box('post', s * 0.95 - 0.05, s * 0.95 + 0.05, -0.75, -0.65, 0.16, 2.5, trim)
    for x0, x1, z0, z1 in ((-0.67, -0.55, 0, 2.27), (0.55, 0.67, 0, 2.27), (-0.67, 0.67, 2.15, 2.27)): box('doorFrame', x0, x1, -0.08, 0, z0, z1, trim)
    box('inside', -0.55, 0.55, -0.02, 0, 0.16, 2.15, inside)   # 门洞里的暖光：门关着时被门板挡住
    door = box('door', 0, 1.1, -0.05, 0, 0, 1.99, wood, None); door.parent = root; door.location = (-0.55, -0.03, 0.16)   # 门轴在左边，往外开
    box('knob', 0.93, 1.0, -0.1, -0.05, 0.9, 0.97, lamp, door)
    bars = []
    for i, (x0, z0, w, h) in enumerate(((-2.6, 1.0, 1.7, 1.6), (1.1, 1.2, 1.2, 1.2))):   # 大窗（放照片）、小窗
        for a, b, c, d in ((x0 - 0.12, x0, z0 - 0.12, z0 + h + 0.12), (x0 + w, x0 + w + 0.12, z0 - 0.12, z0 + h + 0.12), (x0, x0 + w, z0 + h, z0 + h + 0.12)): box('winFrame', a, b, -0.1, 0, c, d, trim)
        box('sill', x0 - 0.2, x0 + w + 0.2, -0.24, 0, z0 - 0.12, z0, trim); box('glass', x0, x0 + w, -0.03, 0, z0, z0 + h, glass)
        b = [box('bar', x0 + w / 2 - 0.035, x0 + w / 2 + 0.035, -0.07, -0.03, z0, z0 + h, trim), box('bar', x0, x0 + w, -0.07, -0.03, z0 + h / 2 - 0.035, z0 + h / 2 + 0.035, trim)]
        if i == 0: bars = b   # 大窗放了照片就不要窗棂
    me = bpy.data.meshes.new('photo'); me.from_pydata([(-.5, 0, -.5), (.5, 0, -.5), (.5, 0, .5), (-.5, 0, .5)], [], [[0, 1, 2, 3]]); uv = me.uv_layers.new()
    for i, q in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))): uv.data[i].uv = q
    pm, pE = mat('photo', '#ffffff', 1); tex = pm.node_tree.nodes.new('ShaderNodeTexImage'); pE and pm.node_tree.links.new(tex.outputs[0], pE.inputs[0]); me.materials.append(pm)
    photo = bpy.data.objects.new('photo', me); sc.collection.objects.link(photo); photo.parent = root; photo.location = (-1.75, -0.05, 1.8); O.append(photo)
    box('lamp', 0.74, 0.86, -0.2, -0.08, 2.24, 2.38, lamp)
    lampL = light('lampL', 'POINT', (0.8, -0.45, 2.3), lin('#ffb060')); lampL.data.shadow_soft_size = 0.1
    doorL = light('doorL', 'AREA', (0, -0.12, 1.15), lin('#ffc070')); doorL.data.shape, doorL.data.size, doorL.data.size_y = 'RECTANGLE', 1.0, 1.9; doorL.rotation_euler = (-math.pi / 2, 0, 0)   # 门里的光往外照
    img = {}
    def put(h, repo):
        for o in O: o.hide_render = not h
        if not h: return
        win, dr, ph = h.get('win', 0), h.get('door', 0), h.get('ph')
        for mul, c in TOON: mul.inputs[1].default_value = mixv(list(c), list(lin('#2a3160')), 0.6 * h.get('night', 0))   # 夜里墙压暗，窗和灯才亮得出来
        root.location = (h['x'], h['z'], 0); door.rotation_euler = (0, 0, -D(105) * dr)
        gE.inputs[0].default_value = (*mixv(list(lin('#33405e')), list(lin('#ffcf7a')), win), 1); lE.inputs[1].default_value = 4 * win; iE.inputs[1].default_value = 0.3 + 1.2 * dr
        lampL.data.energy, doorL.data.energy = 250 * win, 500 * dr
        photo.hide_render = not ph
        for o in bars: o.hide_render = bool(ph)
        if ph:
            if ph not in img: tx = (repo / 'photos.js').read_text(encoding='utf-8'); img[ph] = bpy.data.images.load(str(repo / json.loads(tx[tx.index('{'):tx.rindex('}') + 1])['files'][ph]))   # ph 是 photos.js 里的键；repo 这里是项目文件夹
            im = img[ph]; k = min(1.7 / im.size[0], 1.6 / im.size[1]) * 0.86; tex.image = im; photo.scale = (im.size[0] * k, 1, im.size[1] * k); pE.inputs[1].default_value = win
    return put

def build(job):
    global GLB; GLB = job['mode'] == 'glb'
    root = Path(job['root']); repo = root.parents[1]; sc = bpy.context.scene
    track = json.loads((root / 'blender' / 'track.json').read_text(encoding='utf-8'))
    miss = [s['id'] for s in job['shots'] if s['blender'] and s['id'] not in track]
    if miss: raise SystemExit('track.json 里没有这些镜头，先跑 blender/track.py：' + '、'.join(miss))
    sys.path.insert(0, str(repo / '.claude/.cache/blender-addons')); addon_utils.enable('io_scene_vrm', default_set=True)
    sc.render.film_transparent = True; sc.render.image_settings.color_mode = 'RGBA'; sc.view_settings.view_transform = 'Standard'   # 透明底；人物贴图的颜色照原样出
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.7, 0.7, 0.7, 1); bg.inputs[1].default_value = 0.4
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 2.5   # 光只定方向；颜色在 Canvas 里按天色罩（WORLD.lit）
    A = {who: load(who, repo.parent / '建模' / f) for who, f in SRC.items()}
    put_house = house(sc)
    for name in {n for tr in track.values() for S in tr['frames'] for n in S.get('pts', {})}:   # scene.js 给的世界里的点（pts），手可以去够：'pt.名字'
        e = bpy.data.objects.new('pt.' + name, None); sc.collection.objects.link(e); ANCH[e.name] = e
    for sid in track:
        cam = bpy.data.objects.new('cam_' + sid, bpy.data.cameras.new('cam_' + sid)); sc.collection.objects.link(cam)
        cam.rotation_euler = (math.pi / 2, 0, 0); cam.data.sensor_fit, cam.data.sensor_width, cam.data.clip_start = 'HORIZONTAL', 36, 0.05   # 只平移不转，跟 WORLD.proj 一样

    def apply(scene, *_):
        tr = track.get(scene.camera.name[4:]) if scene.camera else None
        if not tr: return
        f = scene.frame_current + scene.frame_subframe; S = sample(tr, f); c = S['cam']; cam = scene.camera
        cam.location = (c['x'], c['z'], c['y']); cam.data.lens = c['f'] / 1920 * 36; cam.data.shift_y = (c['hy'] - 540) / 1920   # 地平线高低用镜头平移对
        k = S.get('key', [0.6, -0.6]); sun.rotation_euler = Vector((-k[0], 0.6, k[1])).to_track_quat('-Z', 'Y').to_euler()   # 光从画面的哪边来（world.js MOODS 的 key）
        for n, p in S.get('pts', {}).items(): ANCH['pt.' + n].location = (p[0], p[2], p[1])
        if not GLB: put_house(S.get('house'), root)
        def where_at(S):   # 那一刻看的地方
            def where(L):
                if isinstance(L, list): return Vector((L[0], L[2], L[1]))
                if L == 'cam': return Vector(cam.location)
                o = S.get(L) if L else None
                return Vector((o['x'], o['z'], o.get('y', 0) + A[L]['headz'] * (1 - 0.55 * o.get('sit', 0)))) if o else None
            return where
        where = where_at(S)
        S0, S1, wd = sample(tr, f - 2), sample(tr, f + 2), S.get('wind', [0, 0])   # wind：风往世界的哪边吹 [x, z]（米/秒）
        for i, who in enumerate(A):
            p0, p1 = S0.get(who), S1.get(who); v = [(p1[q] - p0[q]) * 15 for q in 'xz'] if p0 and p1 else [0, 0]
            pose(A[who], smooth_pose(A[who], tr, f, who, where_at), f / 60, 1 + i * 1.7, where, (wd[0] - v[0], wd[1] - v[1]))
    if not GLB: bpy.app.handlers.frame_change_pre.append(apply); return
    # 网页预览的代理（scene.js 的 proxy）：blender/scene.glb 是没摆姿势的模型，blender/poses.json 是每个镜头每 STEP 帧一份摆好以后的骨头（含 IK）。
    # 每根骨头记「从静止到这一刻」在人物自己坐标里转了多少（四元数 w x y z），hips 另记挪了多少；scene.js 照着摆，所以预览的动作和成片一样。改了 track.json 或 pose 就重跑 blender.py <项目> glb
    STEP = 4; names = {who: sorted(a['pb']) for who, a in A.items()}; shots = {}
    for sid, tr in track.items():
        sc.camera = bpy.data.objects['cam_' + sid]; F = []
        for f in range(tr['f0'], tr['f0'] + tr['step'] * (len(tr['frames']) - 1) + 1, STEP):
            sc.frame_set(f); apply(sc); bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); one = {}
            for who, a in A.items():
                if a['objs'][0].hide_render: continue
                ev, bones, q = a['arm'].evaluated_get(dg).pose.bones, a['arm'].data.bones, []
                for k in names[who]: n = a['pb'][k].name; q += [round(x, 4) for x in (ev[n].matrix @ bones[n].matrix_local.inverted()).to_quaternion()]
                n = a['pb']['hips'].name; one[who] = {'q': q, 'h': [round(x, 4) for x in ev[n].matrix.translation - bones[n].matrix_local.translation], 'f': {k: round(a['face'][k].value, 3) for k in a['fcl'] if a['face'][k].value > 0.004}}   # f 表情（滤过的，含眨眼）
            F.append(one)
        shots[sid] = {'f0': tr['f0'], 'step': STEP, 'frames': F}; print('姿势', sid, len(F), '份', flush=True)
    (root / 'blender' / 'poses.json').write_text(json.dumps({'bones': {who: [a['pb'][k].name for k in names[who]] for who, a in A.items()}, 'shots': shots}, separators=(',', ':')), encoding='utf-8')
    sc.camera = None   # 模型按静止姿势导出
    for a in A.values():
        a['arm'].location, a['arm'].rotation_euler = (0, 0, 0), (0, 0, 0)
        for b in a['arm'].pose.bones: b.rotation_quaternion, b.location = (1, 0, 0, 0), (0, 0, 0)
        for c in a['ik'].values(): c.influence = 0
        for k in a['fcl']: a['face'][k].value = 0
    bpy.context.view_layer.update()
