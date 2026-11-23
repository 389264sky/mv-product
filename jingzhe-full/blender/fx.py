"""会动的小东西（几何节点 + 体积），公式照 jz_lake.js 搬：时间都用变速后的世界时间 tw（track.json 逐帧给）。
下雪（bar1–11，bar11–13 停）、bar8→9 雪被热气卷成签名螺旋、bar12→13 横着飘过镜头的白汽、火种烧起来后的烟和签名螺旋的火星屑。
坐标：three (x, y, z) → Blender (x, -z, y)。
"""
import math
import bpy


class Gn:
    """几何节点的小工具：数字直接当常量，插口直接连"""
    def __init__(s, name):
        s.ng = bpy.data.node_groups.new(name, 'GeometryNodeTree'); s.T = s.ng.nodes; s.L = s.ng.links
        s.ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
        s.ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
        s.gi, s.go = s.T.new('NodeGroupInput'), s.T.new('NodeGroupOutput'); s.ins = {}

    def inp(s, name, kind='NodeSocketFloat'):
        it = s.ng.interface.new_socket(name, in_out='INPUT', socket_type=kind); s.ins[name] = it.identifier
        return s.gi.outputs[name]

    def put(s, sock, v):
        if v is None: return
        if isinstance(v, bpy.types.NodeSocket): s.L.new(v, sock)
        else: sock.default_value = v

    def n(s, kind, **props):
        x = s.T.new(kind)
        for k, v in props.items(): setattr(x, k, v)
        return x

    def m(s, op, a, b=None, c=None):
        x = s.n('ShaderNodeMath', operation=op)
        for i, v in enumerate((a, b, c)): s.put(x.inputs[i], v)
        return x.outputs[0]

    def v(s, op, a, b=None, c=None):
        x = s.n('ShaderNodeVectorMath', operation=op)
        for i, w in enumerate((a, b, c)): s.put(x.inputs[i], w)
        return x.outputs['Value' if op in ('LENGTH', 'DOT_PRODUCT', 'DISTANCE') else 'Vector']

    def xyz(s, x, y, z):
        c = s.n('ShaderNodeCombineXYZ')
        for i, w in enumerate((x, y, z)): s.put(c.inputs[i], w)
        return c.outputs[0]

    def sep(s, vec):
        c = s.n('ShaderNodeSeparateXYZ'); s.put(c.inputs[0], vec); return c.outputs[0], c.outputs[1], c.outputs[2]

    def rnd(s, seed, vec=False, lo=0.0, hi=1.0, id=None):
        x = s.n('FunctionNodeRandomValue', data_type='FLOAT_VECTOR' if vec else 'FLOAT')
        ins = [k for k in x.inputs if k.enabled]; outs = [k for k in x.outputs if k.enabled]
        s.put(ins[0], (lo,) * 3 if vec else lo); s.put(ins[1], (hi,) * 3 if vec else hi)
        s.L.new(id if id is not None else s.n('GeometryNodeInputIndex').outputs[0], [k for k in ins if k.name == 'ID'][0]); [k for k in ins if k.name == 'Seed'][0].default_value = seed
        return outs[0]

    def points(s, count, pos, radius):
        x = s.n('GeometryNodePoints'); x.inputs['Count'].default_value = count; s.put(x.inputs['Position'], pos); s.put(x.inputs['Radius'], radius)
        return x.outputs[0]

    def store(s, geo, name, val, kind='FLOAT'):
        x = s.n('GeometryNodeStoreNamedAttribute', data_type=kind, domain='POINT'); s.put(x.inputs['Geometry'], geo); x.inputs['Name'].default_value = name
        s.put([k for k in x.inputs if k.name == 'Value' and k.enabled][0], val); return x.outputs[0]

    def delete(s, geo, sel):
        x = s.n('GeometryNodeDeleteGeometry', domain='POINT'); s.put(x.inputs['Geometry'], geo); s.put(x.inputs['Selection'], sel); return x.outputs[0]

    def mat(s, geo, m):
        x = s.n('GeometryNodeSetMaterial'); s.put(x.inputs['Geometry'], geo); x.inputs['Material'].default_value = m; return x.outputs[0]

    def pair(s):
        """一粒画成两个点（头、尾）：返回粒子编号 oid、是不是尾 tail"""
        i = s.n('GeometryNodeInputIndex').outputs[0]; return s.m('FLOOR', s.m('DIVIDE', i, 2.0)), s.m('MODULO', i, 2.0)

    def tag(s, geo, oid, tail, radius):
        """删点之前把粒子编号、头尾、半径存下来：删完以后 Index 变了，再按 Index 配对头尾会连错，拉出长线"""
        return s.store(s.store(s.store(geo, 'oid', oid), 'tl', tail), 'rad', radius)

    def named(s, name):
        x = s.n('GeometryNodeInputNamedAttribute', data_type='FLOAT'); x.inputs['Name'].default_value = name; return x.outputs['Attribute']

    def streaks(s, geo):
        """头尾两个点（tag 存的）连成一小段线（拖影），再套成 6 边的细管：Cycles（5.3）对几何节点点云的运动模糊不生效，几何节点出的曲线也渲不出来"""
        x = s.n('GeometryNodePointsToCurves'); s.put(x.inputs['Points'], geo); s.put(x.inputs['Curve Group ID'], s.named('oid')); s.put(x.inputs['Weight'], s.named('tl'))
        radius = s.named('rad')
        c = s.n('GeometryNodeCurvePrimitiveCircle'); c.inputs['Resolution'].default_value = 6; c.inputs['Radius'].default_value = 1.0
        m = s.n('GeometryNodeCurveToMesh'); s.put(m.inputs['Curve'], x.outputs[0]); s.put(m.inputs['Profile Curve'], c.outputs['Curve']); m.inputs['Fill Caps'].default_value = True
        s.put(m.inputs['Scale'], radius)   # 5.3 的 Scale 默认 1，不读曲线的 radius
        return m.outputs[0]

    def out(s, geo):
        s.L.new(geo, s.go.inputs[0])

    def obj(s, name, coll=None):
        me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); (coll or bpy.context.scene.collection).objects.link(ob)
        md = ob.modifiers.new('fx', 'NODES'); md.node_group = s.ng; return ob, md

    def key(s, md, name):
        return getattr(md.properties.inputs, s.ins[name])


def snowfall(mt, cam, top, dt=1 / 120):
    """镜头周围 12 米的盒子里循环飘落（盒子跟着镜头）；雪片 1–3 毫米，每片画成半帧快门（1/120 秒）里落下的那一小段，贴着镜头的虚成光斑（景深）"""
    g = Gn('snowfall'); t = g.inp('t'); dens = g.inp('dens'); H = 6.0; N = 120000
    oid, tail = g.pair(); tt = g.m('SUBTRACT', t, g.m('MULTIPLY', tail, dt))
    ci = g.n('GeometryNodeObjectInfo', transform_space='ORIGINAL'); ci.inputs['Object'].default_value = cam; cp = ci.outputs['Location']
    p0 = g.rnd(1, True, -H, H, oid); r = g.rnd(2, True, 0.0, 1.0, oid); rx, ry, rz = g.sep(r); sd = g.rnd(3, False, 0.0, 1.0, oid)
    vel = g.xyz(g.m('MULTIPLY_ADD', rx, 0.6, 0.0), g.m('MULTIPLY_ADD', ry, 0.4, -0.3), g.m('MULTIPLY_ADD', rz, -0.4, -0.9))   # three 的 (0.3±0.3, -0.9-0.4r, 0.1±0.2) 换成 Blender
    def at(tm):
        sw = g.xyz(g.m('MULTIPLY', g.m('SINE', g.m('MULTIPLY_ADD', tm, 1.3, g.m('MULTIPLY', sd, 20.0))), 0.25), g.m('MULTIPLY', g.m('COSINE', g.m('MULTIPLY_ADD', tm, 1.1, g.m('MULTIPLY', sd, 30.0))), -0.25), 0.0)
        return g.v('ADD', g.v('ADD', p0, g.v('MULTIPLY', vel, g.xyz(tm, tm, tm))), sw)
    ph = at(t)
    k = g.v('FLOOR', g.v('DIVIDE', g.v('ADD', g.v('SUBTRACT', ph, cp), (H, H, H)), (2 * H, 2 * H, 2 * H)))   # 折回按头算，头尾一起折，不会在盒子边上拉出长线
    p = g.v('SUBTRACT', at(tt), g.v('MULTIPLY', k, (2 * H, 2 * H, 2 * H)))
    geo = g.tag(g.points(2 * N, p, 0.001), oid, tail, g.rnd(4, False, 0.0005, 0.0014, oid))
    hz = g.sep(g.v('SUBTRACT', ph, g.v('MULTIPLY', k, (2 * H, 2 * H, 2 * H))))[2]
    geo = g.delete(geo, g.m('MAXIMUM', g.m('LESS_THAN', hz, top + 0.003), g.m('GREATER_THAN', g.rnd(5, False, 0.0, 1.0, oid), dens)))
    geo = g.streaks(geo)
    g.out(g.mat(geo, mt)); ob, md = g.obj('snowfall')
    ob.cycles.use_motion_blur = ob.cycles.use_deform_motion = False   # 拖影自己画了；只关 use_motion_blur 不够，盒子折回会被形变模糊拉成长线
    return ob, md, g


def spiral_snow(mt, BB9, dt=1 / 120):
    """bar8→9：冰洞周围的雪被热气卷起来，沿签名螺旋（从上往下看顺时针）旋成往上走的一股，散开再落回冰上；每粒画成半帧快门里走的那一小段"""
    g = Gn('swirl'); t = g.inp('t'); N = 5000
    oid, tail = g.pair(); R = lambda seed, lo, hi: g.rnd(seed, False, lo, hi, oid)
    t = g.m('SUBTRACT', t, g.m('MULTIPLY', tail, dt))
    a0 = R(11, 0.0, 6.2832); r0 = g.m('MULTIPLY_ADD', g.m('SQRT', R(12, 0.0, 1.0)), 1.4, 0.9)
    vh = R(13, 1.2, 2.0); vr = R(14, 0.1, 0.2); tn = R(15, 0.7, 1.0)
    birth = R(16, BB9 - 1.2, BB9 + 0.6); life = R(17, 2.6, 3.4)   # 一阵阵卷起来，不是一下子全冒出来
    u = g.m('SUBTRACT', t, birth); uc = g.m('MAXIMUM', u, 0.0)
    a = g.m('ADD', a0, g.m('DIVIDE', g.m('MULTIPLY', uc, g.m('MULTIPLY', tn, 6.2832)), life))
    rr = g.m('MULTIPLY_ADD', vr, uc, r0); h = g.m('MAXIMUM', g.m('ADD', g.m('MULTIPLY_ADD', vh, uc, 0.03), g.m('MULTIPLY', g.m('MULTIPLY', uc, uc), -0.15)), 0.0)
    p = g.xyz(g.m('MULTIPLY', g.m('COSINE', a), rr), g.m('MULTIPLY', g.m('SINE', a), g.m('MULTIPLY', rr, -1.0)), g.m('ADD', h, 0.03))
    geo = g.points(2 * N, p, 0.001)
    geo = g.store(geo, 'k', g.m('DIVIDE', uc, life))
    geo = g.tag(geo, oid, tail, g.m('MULTIPLY', R(18, 0.0004, 0.0011), g.m('MINIMUM', g.m('MULTIPLY', g.m('DIVIDE', uc, life), 6.0), 1.0)))   # 细雪粉，雾里的闪点；刚卷起来的更细
    geo = g.delete(geo, g.m('MAXIMUM', g.m('LESS_THAN', u, 0.0), g.m('GREATER_THAN', u, life)))
    geo = g.streaks(geo)
    g.out(g.mat(geo, mt)); ob, md = g.obj('swirl')
    ob.cycles.use_motion_blur = ob.cycles.use_deform_motion = False
    return ob, md, g


def sparks(mt, dt=1 / 30):
    """签名螺旋的火星屑：从炭块两侧冒出来，绕着它打旋往上走一圈多（从上往下看顺时针），越高圈越大、顺风歪，走到头熄成灰（同 jz_lake.js 的 spk）。
    每粒画成一小段线：头是现在的位置，尾是 dt 秒前的（像 1/30 秒快门拍的拖影）；刚出生的不往出生之前拖"""
    g = Gn('sparks'); t = g.inp('t'); E = g.inp('E', 'NodeSocketVector'); dim = g.inp('dim'); N = 360
    oid, tail = g.pair(); R = lambda seed, lo, hi: g.rnd(seed, False, lo, hi, oid)
    side = g.m('MULTIPLY', g.m('MODULO', oid, 2.0), math.pi)
    a0 = g.m('ADD', side, R(21, -0.35, 0.35)); r0 = R(22, 0.18, 0.24); h0 = R(23, 0.04, 0.16)
    vh = R(24, 0.32, 0.44); vr = R(25, 0.07, 0.11); tn = R(26, 1.2, 1.5)
    birth = R(27, 0.0, 5.0); life = R(28, 3.0, 4.5)
    u0 = g.m('FLOORED_MODULO', g.m('SUBTRACT', t, birth), life); tb = g.m('SUBTRACT', t, u0)   # 这一轮出生的时刻
    u = g.m('SUBTRACT', u0, g.m('MULTIPLY', tail, g.m('MINIMUM', u0, dt)))
    a = g.m('ADD', g.m('ADD', a0, g.m('MULTIPLY', tb, 0.12)), g.m('DIVIDE', g.m('MULTIPLY', u, g.m('MULTIPLY', tn, 6.2832)), life))
    rr = g.m('MULTIPLY_ADD', vr, u, r0); h = g.m('ADD', g.m('MULTIPLY_ADD', vh, u, h0), g.m('MULTIPLY', g.m('MULTIPLY', u, u), 0.03))
    w = g.m('ADD', g.m('MULTIPLY', h, 0.10), g.m('MULTIPLY', g.m('MULTIPLY', h, h), 0.035))
    p = g.v('ADD', E, g.xyz(g.m('MULTIPLY_ADD', w, 0.96, g.m('MULTIPLY', g.m('COSINE', a), rr)), g.m('MULTIPLY', g.m('MULTIPLY_ADD', w, 0.28, g.m('MULTIPLY', g.m('SINE', a), rr)), -1.0), h))
    geo = g.points(2 * N, p, 0.001)
    k = g.m('DIVIDE', u0, life)
    geo = g.store(geo, 'k', k)
    geo = g.store(geo, 'g', g.m('MULTIPLY', g.m('MULTIPLY', g.m('MULTIPLY', g.m('POWER', g.m('SUBTRACT', 1.0, k), 1.3), g.m('MINIMUM', g.m('MULTIPLY', u0, 20.0), 1.0)), dim),
                                g.m('MULTIPLY_ADD', tail, -0.75, 1.0)))   # 尾巴那头暗
    geo = g.tag(geo, oid, tail, R(29, 0.0006, 0.0012))
    geo = g.delete(geo, g.m('LESS_THAN', dim, 0.002))
    geo = g.streaks(geo)
    g.out(g.mat(geo, mt)); ob, md = g.obj('sparks')
    ob.cycles.use_motion_blur = ob.cycles.use_deform_motion = False
    return ob, md, g


def m_flake():
    m = bpy.data.materials.new('flake'); nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (0.9, 0.93, 0.98, 1); p.inputs['Roughness'].default_value = 0.6; p.inputs['Transmission Weight'].default_value = 0.3
    nt.links.new(p.outputs[0], o.inputs['Surface']); return m


def m_spark():
    """火星屑：刚出来金黄，飞着变橙红，最后熄成灰"""
    m = bpy.data.materials.new('spark'); nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    ak = nt.nodes.new('ShaderNodeAttribute'); ak.attribute_name = 'k'; ag = nt.nodes.new('ShaderNodeAttribute'); ag.attribute_name = 'g'
    r = nt.nodes.new('ShaderNodeValToRGB'); el = r.color_ramp.elements
    el[0].position, el[0].color = 0.05, (1.0, 0.62, 0.25, 1); el[1].position, el[1].color = 0.95, (0.12, 0.11, 0.11, 1); x = el.new(0.55); x.color = (0.95, 0.22, 0.04, 1)
    nt.links.new(ak.outputs['Fac'], r.inputs[0]); nt.links.new(r.outputs[0], e.inputs['Color'])
    s = nt.nodes.new('ShaderNodeMath'); s.operation = 'MULTIPLY'; s.inputs[1].default_value = 60.0; nt.links.new(ag.outputs['Fac'], s.inputs[0]); nt.links.new(s.outputs[0], e.inputs['Strength'])
    nt.links.new(e.outputs[0], o.inputs['Surface']); return m


def volume_box(name, size, mat_fn):
    """装体积的盒子（原点在底面中心）；密度场在材质里按物体坐标当米算，所以尺寸写进网格，不放进物体缩放"""
    bpy.ops.mesh.primitive_cube_add(size=1.0); ob = bpy.context.active_object; ob.name = name
    M = __import__('mathutils').Matrix; ob.data.transform(M.Diagonal((*size, 1.0)) @ M.Translation((0, 0, 0.5)))
    ob.data.materials.append(mat_fn()); return ob


def m_plume():
    """火种的烟：一缕，中轴顺风弯过去（和 jz_lake.js 的 plume 一样：w = 0.10h + 0.035h²，风向 (0.96, -0.28)），越高越粗越淡，带乱流；下面被火照红（Cycles 自己算）"""
    m = bpy.data.materials.new('plume'); nt = m.node_tree; nt.nodes.clear(); N = nt.nodes; Lk = nt.links
    o = N.new('ShaderNodeOutputMaterial'); vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (0.55, 0.56, 0.6, 1); vol.inputs['Anisotropy'].default_value = 0.35
    tc = N.new('ShaderNodeTexCoord'); sp = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sp.inputs[0])
    tv = N.new('ShaderNodeValue'); tv.name = 't'; sv = N.new('ShaderNodeValue'); sv.name = 'smoke'
    def M(op, a, b=None, c=None):
        x = N.new('ShaderNodeMath'); x.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: Lk.new(v, x.inputs[i])
        return x.outputs[0]
    h = M('MAXIMUM', sp.outputs['Z'], 0.0)
    w = M('ADD', M('MULTIPLY', h, 0.10), M('MULTIPLY', M('MULTIPLY', h, h), 0.035))
    dx = M('SUBTRACT', sp.outputs['X'], M('MULTIPLY', w, 0.96)); dy = M('SUBTRACT', sp.outputs['Y'], M('MULTIPLY', w, -0.28))
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 3.5; nz.inputs['Detail'].default_value = 6.0; nz.inputs['Roughness'].default_value = 0.6
    cm = N.new('ShaderNodeCombineXYZ'); Lk.new(sp.outputs['X'], cm.inputs[0]); Lk.new(sp.outputs['Y'], cm.inputs[1]); Lk.new(M('SUBTRACT', sp.outputs['Z'], M('MULTIPLY', tv.outputs[0], 0.9)), cm.inputs[2])
    Lk.new(cm.outputs[0], nz.inputs['Vector']); Lk.new(tv.outputs[0], nz.inputs['W'])
    wob = M('MULTIPLY', M('SUBTRACT', nz.outputs['Fac'], 0.5), M('MULTIPLY_ADD', h, 0.6, 0.04))   # 乱流大，一缕缕摆
    rad = M('MULTIPLY_ADD', h, 0.09, 0.025)
    d2 = M('DIVIDE', M('ADD', M('MULTIPLY', M('ADD', dx, wob), M('ADD', dx, wob)), M('MULTIPLY', dy, dy)), M('MULTIPLY', rad, rad))
    core = M('EXPONENT', M('MULTIPLY', d2, -1.0))
    den = M('MULTIPLY', M('MULTIPLY', M('MULTIPLY', core, M('POWER', nz.outputs['Fac'], 3.0)), M('EXPONENT', M('MULTIPLY', h, -0.9))), M('MULTIPLY', sv.outputs[0], 22.0))   # 淡、断成一缕缕，不是一根柱子
    den = M('MULTIPLY', den, M('MINIMUM', M('MULTIPLY', sp.outputs['Z'], 8.0), 1.0))
    Lk.new(den, vol.inputs['Density']); Lk.new(vol.outputs[0], o.inputs['Volume']); return m


def m_steam():
    """bar12→13 的白汽：一团从冰洞里冒出来、横着飘的雾，边被乱流撕成一缕缕；月光下发灰白，靠火那边暖（Cycles 自己算）"""
    m = bpy.data.materials.new('steam'); nt = m.node_tree; nt.nodes.clear(); N = nt.nodes; Lk = nt.links
    o = N.new('ShaderNodeOutputMaterial'); vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (0.95, 0.96, 0.98, 1); vol.inputs['Anisotropy'].default_value = 0.1   # 这一镜月亮在镜头身后（顺光），前向散射大了白汽是黑的
    tc = N.new('ShaderNodeTexCoord'); tv = N.new('ShaderNodeValue'); tv.name = 't'; dv = N.new('ShaderNodeValue'); dv.name = 'dens'
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 3.5; nz.inputs['Detail'].default_value = 9.0; nz.inputs['Roughness'].default_value = 0.66; nz.inputs['Distortion'].default_value = 0.8
    Lk.new(tc.outputs['Object'], nz.inputs['Vector']); Lk.new(tv.outputs[0], nz.inputs['W'])
    gr = N.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'; Lk.new(tc.outputs['Generated'], gr.inputs['Vector'])
    mp = N.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (-1.0, -1.0, -1.0); mp.inputs['Scale'].default_value = (2, 2, 2)   # 生成坐标 0..1 → -1..1，球心在盒子正中; Lk.new(tc.outputs['Generated'], mp.inputs['Vector']); Lk.new(mp.outputs[0], gr.inputs['Vector'])
    def M(op, a, b):
        x = N.new('ShaderNodeMath'); x.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: Lk.new(v, x.inputs[i])
        return x.outputs[0]
    den = M('MULTIPLY', M('MULTIPLY', M('MAXIMUM', M('SUBTRACT', M('MULTIPLY', gr.outputs['Fac'], 1.4), M('MULTIPLY', M('SUBTRACT', 1.0, nz.outputs['Fac']), 1.6)), 0.0), dv.outputs[0]), 25.0)   # 边被撕成一缕缕
    Lk.new(den, vol.inputs['Density']); Lk.new(vol.outputs[0], o.inputs['Volume']); return m


def m_swirlmist():
    """雪旋的雪雾：贴着螺旋那股的细雪粉，比雪粒淡"""
    m = bpy.data.materials.new('swirlmist'); nt = m.node_tree; nt.nodes.clear(); N = nt.nodes; Lk = nt.links
    o = N.new('ShaderNodeOutputMaterial'); vol = N.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (0.9, 0.92, 0.96, 1); vol.inputs['Anisotropy'].default_value = 0.6
    tc = N.new('ShaderNodeTexCoord'); sp = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sp.inputs[0])
    tv = N.new('ShaderNodeValue'); tv.name = 't'; dv = N.new('ShaderNodeValue'); dv.name = 'dens'
    def M(op, a, b=None, c=None):
        x = N.new('ShaderNodeMath'); x.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: Lk.new(v, x.inputs[i])
        return x.outputs[0]
    r = M('SQRT', M('ADD', M('MULTIPLY', sp.outputs['X'], sp.outputs['X']), M('MULTIPLY', sp.outputs['Y'], sp.outputs['Y'])))
    th = M('ARCTAN2', sp.outputs['Y'], sp.outputs['X']); h = M('MAXIMUM', sp.outputs['Z'], 0.0)
    arm = M('MULTIPLY_ADD', M('COSINE', M('ADD', M('MULTIPLY', M('ADD', th, M('MULTIPLY', h, 2.2)), 2.0), M('MULTIPLY', tv.outputs[0], 5.0))), 0.5, 0.5)   # 两条旋臂，顺时针往上拧
    R = M('MULTIPLY_ADD', h, 0.25, 1.1)
    ring = M('EXPONENT', M('MULTIPLY', M('POWER', M('DIVIDE', M('SUBTRACT', r, R), M('MULTIPLY_ADD', h, 0.1, 0.22)), 2.0), -1.0))   # 收紧的一股，往上略张开
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 6.0
    Lk.new(tc.outputs['Object'], nz.inputs['Vector']); Lk.new(tv.outputs[0], nz.inputs['W'])
    den = M('MULTIPLY', M('MULTIPLY', M('MULTIPLY', ring, arm), M('POWER', nz.outputs['Fac'], 3.0)), M('MULTIPLY', M('EXPONENT', M('MULTIPLY', h, -0.8)), M('MULTIPLY', dv.outputs[0], 10.0)))
    den = M('MULTIPLY', den, M('MAXIMUM', M('SUBTRACT', 1.0, M('MULTIPLY', h, 0.25)), 0.0))   # 4 米以上没有
    Lk.new(den, vol.inputs['Density']); Lk.new(vol.outputs[0], o.inputs['Volume']); return m
