"""山、湖盆、林带：jz_land.js 的 height()、林带、一棵棵针叶树的位置，逐行搬成 numpy（整数哈希一样，图案一样）。
坐标是 three.js 的（x 东、z 南、y 上，水面 y = 0）；build.py 换成 Blender 的（x, -z, y）。
"""
import numpy as np

U = np.uint32


def h3(x, y, z):
    with np.errstate(over='ignore'):
        x = x.astype(U) * U(1664525) + U(1013904223); y = y.astype(U) * U(1664525) + U(1013904223); z = z.astype(U) * U(1664525) + U(1013904223)
        x = x + y * z; y = y + z * x; z = z + x * y
        x ^= x >> U(16); y ^= y >> U(16); z ^= z >> U(16)
        x = x + y * z; y = y + z * x; z = z + x * y
        return x ^ y ^ z


def ivec(a):   # float → int（截断）→ 按位当 uint
    return a.astype(np.int64).astype(np.int32).view(U) if a.dtype != U else a


def hh(ix, iy):
    return (h3(ivec(ix + 32768), ivec(iy + 32768), np.full(ix.shape, 7, U)) >> U(8)).astype(np.float64) / 16777216.0


def nd(px, py):   # 值噪声（五次插值）和坡度
    ix, iy = np.floor(px), np.floor(py); fx, fy = px - ix, py - iy
    ux, uy = fx ** 3 * (fx * (fx * 6 - 15) + 10), fy ** 3 * (fy * (fy * 6 - 15) + 10)
    dux, duy = 30 * fx * fx * (fx * (fx - 2) + 1), 30 * fy * fy * (fy * (fy - 2) + 1)
    a, b, c, d = hh(ix, iy), hh(ix + 1, iy), hh(ix, iy + 1), hh(ix + 1, iy + 1)
    k = a - b - c + d
    return a + (b - a) * ux + (c - a) * uy + k * ux * uy, dux * ((b - a) + k * uy), duy * ((c - a) + k * ux)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def height(x, z):
    px, py = x / 95.0 + 3.1, z / 95.0 + 7.7; dx = np.zeros_like(px); dy = np.zeros_like(px); a = np.zeros_like(px); b = 1.0
    for _ in range(11):
        n, gx, gy = nd(px, py); dx += gx; dy += gy; a += b * n / (1 + dx * dx + dy * dy); b *= 0.5
        px, py = (0.8 * px + 0.6 * py) * 2.0, (-0.6 * px + 0.8 * py) * 2.0
    return -3.0 + smooth(28.0, 170.0, np.hypot(x, z)) * 110.0 * np.power(a, 1.3)


def lowf(x, z):   # 低频噪声（林线、雪线上下错开）
    return 0.6 * nd(x / 70 + 9, z / 70 + 9)[0] + 0.3 * nd(x / 31 + 5, z / 31 + 5)[0] + 0.1 * nd(x / 13, z / 13)[0]


def forest(h, a, slope):
    return (1 - smooth(30, 46, h + 20 * (a - 0.5))) * smooth(0.15, 0.8, h) * (1 - smooth(0.8, 1.3, slope))


def slope(x, z, e=0.1):
    return np.hypot((height(x + e, z) - height(x - e, z)) / (2 * e), (height(x, z + e) - height(x, z - e)) / (2 * e))


def trees(R=320.0):
    """两层错开的格子，一格一棵（空格 18%）。返回 [x, z, 地面高, 树高, 冠半径, 种子]（three 坐标）。"""
    out = []
    for sd, sc in ((1, 0.42), (2, 0.5)):
        n = int(R * sc * 1.5) + 2
        cx, cy = np.meshgrid(np.arange(-n, n, dtype=np.float64), np.arange(-n, n, dtype=np.float64))
        cx, cy = cx.ravel(), cy.ravel()
        if sd == 2: cx, cy = cx + np.floor(7.3), cy + np.floor(7.3)
        h = h3(ivec(cx + 8192), ivec(cy + 8192), np.full(cx.shape, sd, U))
        rx, ry, rz = (h & U(1023)) / 1023.0, ((h >> U(10)) & U(1023)) / 1023.0, ((h >> U(20)) & U(1023)) / 1023.0
        qx, qy = cx + 0.5 + (rx - 0.5) * 0.9, cy + 0.5 + (ry - 0.5) * 0.9   # jz_land.js 是 0.34：俯拍看得出格子，Blender 这边加大（着色器预览的树位置会略不同）
        if sd == 1: x, z = qx / sc, qy / sc
        else: ux, uy = (qx - 7.3) / sc, (qy - 7.3) / sc; x, z = 0.8 * ux - 0.6 * uy, 0.6 * ux + 0.8 * uy   # mat2(0.8,-0.6,0.6,0.8) 的逆
        k = (rz >= 0.18) & (np.hypot(x, z) < R) & (np.hypot(x, z) > 20)
        x, z, rx, ry, rz = x[k], z[k], rx[k], ry[k], rz[k]
        hg = height(x, z); w = forest(hg, lowf(x, z), slope(x, z))
        k = w > 0.01
        out.append(np.stack([x[k], z[k], hg[k], 5.0 * w[k] * (0.4 + 0.6 * rx[k]), 0.345 * 2.0 * np.ones(k.sum()), ry[k] * 1000 + rz[k]], 1))
    return np.concatenate(out)


if __name__ == '__main__':
    import time
    t = time.time(); T = trees(); print('树', len(T), f'{time.time() - t:.1f}s', '高', T[:, 3].min().round(2), T[:, 3].max().round(2))
    print('湖心、30、60、100 米的地面高：', [round(float(height(np.array([r]), np.array([0.0]))[0]), 2) for r in (0, 30, 60, 100, 200)])
