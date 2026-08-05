"""Remove bright neutral matte pixels from the outer edge of lobby portraits.

The script keeps a byte-for-byte backup of each source before updating the
active asset.  It only changes pixels close to transparency whose colour is
both neutral and conspicuously brighter than opaque pixels immediately inside
the silhouette.  This preserves intentional whites such as eyes and blades.
"""

from __future__ import annotations

from pathlib import Path
import shutil

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "img" / "standBy"
BACKUP_DIR = ASSET_DIR / "original_backup_20260806"
FILES = [f"character_{index:02d}.png" for index in range(1, 4)]


def erode(mask: np.ndarray) -> np.ndarray:
    padded = np.pad(mask, 1, constant_values=False)
    result = np.ones_like(mask)
    height, width = mask.shape
    for dy in range(3):
        for dx in range(3):
            result &= padded[dy : dy + height, dx : dx + width]
    return result


def clean_image(source: Path) -> tuple[int, int]:
    image = Image.open(source).convert("RGBA")
    pixels = np.asarray(image).copy()
    rgb = pixels[..., :3].astype(np.float32)
    alpha = pixels[..., 3]
    solid = alpha >= 24

    # Only inspect the first three pixels inside the transparent silhouette.
    inner = solid.copy()
    edge_band = np.zeros_like(solid)
    for _ in range(3):
        next_inner = erode(inner)
        edge_band |= inner & ~next_inner
        inner = next_inner

    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    saturation = maximum - minimum
    suspicious = edge_band & (alpha >= 48) & (luminance >= 112) & (saturation <= 46)

    changed = 0
    height, width = alpha.shape
    output = pixels.copy()
    ys, xs = np.nonzero(suspicious)
    for y, x in zip(ys.tolist(), xs.tolist()):
        best: tuple[float, np.ndarray] | None = None
        for radius in range(1, 6):
            y0, y1 = max(0, y - radius), min(height, y + radius + 1)
            x0, x1 = max(0, x - radius), min(width, x + radius + 1)
            local_alpha = alpha[y0:y1, x0:x1]
            local_rgb = rgb[y0:y1, x0:x1]
            local_lum = luminance[y0:y1, x0:x1]
            local_sat = saturation[y0:y1, x0:x1]
            yy, xx = np.mgrid[y0:y1, x0:x1]
            distance = np.maximum(np.abs(yy - y), np.abs(xx - x))

            # Prefer opaque interior colour that is darker or more chromatic.
            eligible = (
                (local_alpha >= 220)
                & (distance == radius)
                & ((local_lum <= luminance[y, x] - 20) | (local_sat >= saturation[y, x] + 22))
            )
            if not eligible.any():
                continue
            candidates = local_rgb[eligible]
            candidate_lum = local_lum[eligible]
            candidate_sat = local_sat[eligible]
            scores = candidate_lum - candidate_sat * 0.35
            best = (float(scores.min()), candidates[int(scores.argmin())])
            break

        if best is None:
            continue

        replacement = best[1]
        # Blend rather than hard-paint so the original antialiasing remains.
        strength = min(1.0, max(0.55, (luminance[y, x] - replacement.mean()) / 80.0))
        output[y, x, :3] = np.clip(rgb[y, x] * (1.0 - strength) + replacement * strength, 0, 255)
        changed += 1

    Image.fromarray(output, "RGBA").save(source, optimize=True)
    return changed, int(suspicious.sum())


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for filename in FILES:
        source = ASSET_DIR / filename
        backup = BACKUP_DIR / filename
        if not backup.exists():
            shutil.copy2(source, backup)
        changed, candidates = clean_image(source)
        print(f"{filename}: corrected {changed}/{candidates} edge candidates; backup={backup}")


if __name__ == "__main__":
    main()
