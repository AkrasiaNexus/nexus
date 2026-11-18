#!/usr/bin/env python3
"""Split the MAIA no-go-zone STL into named car parts and write a binary glTF (.glb).

Usage:  python3 build_car_glb.py <input.stl> <output.glb>

The STL is one fused mesh, so the split is rule-based:
  * 15 disconnected bodies are identified by triangle count (rank by size).
    The rules below are tuned to this file and the script refuses to run if
    the body sizes change.
  * The one big fused body (the chassis) is split by triangle centroid position.
Units: millimetres. Output is glTF/three.js Y-up, centred on X/Z, lowest point at Y=0.
"""
import json
import struct
import sys

import numpy as np

# Triangle counts of the 15 connected bodies, largest first (checked at runtime).
EXPECTED_SIZES = [18663, 14922, 7594, 5196, 4080, 3484, 2846, 2754,
                  642, 638, 420, 420, 420, 420, 48]
# Names follow the team's own engineering drawing (Renders and Engineering Drawings page).
RANK_DOME = (0, 14)            # the dome in the cockpit (not labelled in the team's drawing), plus a small pin
RANK_BODY = 1
RANK_CO2_CANISTER = 3          # the Ø18 x 52 mm CO2 canister chamber at the tail
RANK_REAR_WING = (6, 7)        # two thin plates ~38 mm above the track
RANK_REAR_PODS = (8, 9)
RANK_WHEEL_BODIES = (2, 4, 5, 10, 11, 12, 13)  # axles, wheels and axle bushes


def read_stl(path):
    raw = open(path, "rb").read()
    count = struct.unpack("<I", raw[80:84])[0]
    dtype = np.dtype([("n", "<f4", (3,)), ("v", "<f4", (3, 3)), ("a", "<u2")])
    arr = np.frombuffer(raw, dtype=dtype, count=count, offset=84)
    return arr["v"].astype(np.float64)


def connected_body_ranks(tris):
    """Return, per triangle, the rank of its connected body (0 = largest)."""
    verts = tris.reshape(-1, 3)
    keys = np.round(verts * 1000).astype(np.int64)
    uniq, inv = np.unique(keys, axis=0, return_inverse=True)
    inv = inv.reshape(-1, 3)
    parent = np.arange(len(uniq))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b, c in inv:
        for u, v in ((a, b), (b, c)):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    roots = np.array([find(i) for i in range(len(uniq))])
    _, labels = np.unique(roots[inv[:, 0]], return_inverse=True)
    sizes = np.bincount(labels)
    order = np.argsort(-sizes, kind="stable")
    rank_of_label = np.empty_like(order)
    rank_of_label[order] = np.arange(len(order))
    return rank_of_label[labels], sizes[order]


def classify(tris, ranks):
    """Assign every triangle to a named part. Returns {part_name: triangle_index_array}."""
    c = tris.mean(axis=1)  # centroids, model space
    x, y, z = c[:, 0], c[:, 1], c[:, 2]
    names = np.full(len(tris), "", dtype=object)

    names[np.isin(ranks, RANK_DOME)] = "dome"
    names[ranks == RANK_CO2_CANISTER] = "co2_canister"
    names[np.isin(ranks, RANK_REAR_WING)] = "rear_wing"

    pods = np.isin(ranks, RANK_REAR_PODS)
    names[pods & (y > 0)] = "rear_pods_l"
    names[pods & (y <= 0)] = "rear_pods_r"

    wheels = np.isin(ranks, RANK_WHEEL_BODIES)
    front = x > -140
    names[wheels & front & (y > 0)] = "wheels_fl"
    names[wheels & front & (y <= 0)] = "wheels_fr"
    names[wheels & ~front & (y > 0)] = "wheels_rl"
    names[wheels & ~front & (y <= 0)] = "wheels_rr"

    body = ranks == RANK_BODY
    nose = body & (x > -76) & (x > -56) & (np.abs(y) < 14)
    wing = body & (x > -76) & ~nose
    tail = body & (x <= -200)
    mid = body & (x > -200) & (x <= -76)
    side = mid & (np.abs(y) >= 20)
    floor = mid & (np.abs(y) < 20) & (z <= 20)
    halo = mid & (np.abs(y) < 20) & (z > 20) & (x >= -165) & (x <= -108)  # halo hoop and cockpit rim
    chassis = mid & (np.abs(y) < 20) & (z > 20) & ~halo
    names[nose] = "nose_cone"
    names[wing] = "front_wing"
    names[tail] = "rear_body"
    names[side & (y > 0)] = "sidepods_l"
    names[side & (y <= 0)] = "sidepods_r"
    names[floor] = "floor"
    names[halo] = "halo"
    names[chassis] = "chassis"

    if np.any(names == ""):
        raise RuntimeError("unassigned triangles: %d" % np.sum(names == ""))
    return {n: np.flatnonzero(names == n) for n in np.unique(names)}


def to_gltf_axes(tris, centre_xz, min_z):
    """Model (x, y, z, Z-up, mm) -> glTF (x, z, -y), centred on X/Z, bottom at Y=0."""
    x = tris[..., 0] - centre_xz[0]  # length, centred
    y = tris[..., 1] - centre_xz[1]  # width, centred
    z = tris[..., 2] - min_z         # height, wheels on the ground
    return np.stack([x, z, -y], axis=-1)  # Z-up -> Y-up (a proper rotation, winding kept)


CREASE_COS = np.cos(np.radians(40))  # faces sharper than 40 degrees keep a hard edge


def corner_normals(tris):
    """Angle-weighted, crease-aware normals per triangle corner.

    The STL is full of long sliver triangles. Weighting by the corner angle
    means slivers (tiny angles) barely affect the shading, so curved panels
    shade smoothly instead of streaking.
    """
    e0 = tris[:, 1] - tris[:, 0]
    e1 = tris[:, 2] - tris[:, 1]
    e2 = tris[:, 0] - tris[:, 2]
    fn = np.cross(e0, -e2)
    fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)

    def angle(a, b):
        cos = np.einsum("ij,ij->i", a, b) / np.maximum(np.linalg.norm(a, axis=1) * np.linalg.norm(b, axis=1), 1e-12)
        return np.arccos(np.clip(cos, -1, 1))

    ang = np.stack([angle(e0, -e2), angle(e1, -e0), angle(e2, -e1)], axis=1)
    _, vid = np.unique(np.round(tris.reshape(-1, 3), 4), axis=0, return_inverse=True)
    vid = vid.reshape(-1, 3)

    incident = {}
    for f in range(len(tris)):
        for c in range(3):
            incident.setdefault(vid[f, c], []).append((f, c))

    out = np.zeros_like(tris)
    for corners in incident.values():
        faces = np.array([f for f, _ in corners])
        weights = np.array([ang[f, c] for f, c in corners])[:, None] * fn[faces]
        similar = fn[faces] @ fn[faces].T > CREASE_COS
        for i, (f, c) in enumerate(corners):
            n = weights[similar[i]].sum(axis=0)
            out[f, c] = n / max(np.linalg.norm(n), 1e-12)
    return out


def indexed(tris, normals):
    """Unique (position, normal) vertices plus a triangle index."""
    data = np.concatenate([tris.reshape(-1, 3), normals.reshape(-1, 3)], axis=1)
    uniq, inv = np.unique(np.round(data, 4), axis=0, return_inverse=True)
    return uniq[:, :3].astype(np.float32), uniq[:, 3:].astype(np.float32), inv.reshape(-1).astype(np.uint32)


def write_glb(parts, path):
    buf = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def blob(data, target):
        buf.extend(b"\0" * ((-len(buf)) % 4))
        offset = len(buf)
        buf.extend(data)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})
        return len(views) - 1

    for name, pos, nrm, idx in parts:
        pv = blob(pos.astype("<f4").tobytes(), 34962)
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(pos), "type": "VEC3",
                          "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist()})
        pa = len(accessors) - 1
        nv = blob(nrm.astype("<f4").tobytes(), 34962)
        accessors.append({"bufferView": nv, "componentType": 5126, "count": len(nrm), "type": "VEC3"})
        na = len(accessors) - 1
        iv = blob(idx.astype("<u4").tobytes(), 34963)
        accessors.append({"bufferView": iv, "componentType": 5125, "count": int(idx.size), "type": "SCALAR"})
        ia = len(accessors) - 1
        meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": pa, "NORMAL": na}, "indices": ia}]})
        nodes.append({"name": name, "mesh": len(meshes) - 1})

    gltf = {"asset": {"version": "2.0", "generator": "maia-build_car_glb"}, "scene": 0,
            "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes,
            "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(buf)}]}
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    bin_chunk = bytes(buf) + b"\0" * ((-len(buf)) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_chunk)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


def main(src, dst):
    tris = read_stl(src)
    ranks, sizes = connected_body_ranks(tris)
    if list(sizes) != EXPECTED_SIZES:
        raise SystemExit("body sizes changed, re-tune the rules: %s" % list(sizes))

    groups = classify(tris, ranks)
    all_pts = tris.reshape(-1, 3)
    lo, hi = all_pts.min(axis=0), all_pts.max(axis=0)
    centre_xz = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2)
    gl = to_gltf_axes(tris, centre_xz, lo[2])
    # Upright check: the car is 50 mm tall and 74 mm wide, so Y (up) must be the shorter span.
    assert np.ptp(gl[..., 1]) < np.ptp(gl[..., 2]), "car is not upright after the axis swap"
    assert abs(gl[..., 1].min()) < 1e-6, "wheels are not on the ground (Y=0)"

    parts, total = [], 0
    for name in sorted(groups):
        idx = groups[name]
        pos, nrm, index = indexed(gl[idx], corner_normals(gl[idx]))
        parts.append((name, pos, nrm, index))
        total += len(idx)
        print("%-14s %6d tris" % (name, len(idx)))
    assert total == len(tris), "triangle count mismatch"
    write_glb(parts, dst)
    print("wrote %s (%d parts, %d triangles)" % (dst, len(parts), total))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
