"""Normalize the four big-zombie contact sheets into transparent Phaser strips."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "assets" / "img" / "create"
OUTPUT = ROOT / "public" / "assets" / "img" / "monster"
WALK_SOURCE = SOURCE / "big_zombie_walk_cycle_12f_transparent.png"
FRAME_SIZE = 256
TARGET_HEIGHT = 230
GROUND_Y = 244

SHEETS = {
    "idle": ("big_zombie_idle.png", 4, 1),
    "walk": ("big_zombie_walk.png", 3, 3),
    "punch": ("big_zombie_punch.png", 3, 2),
    "attack": ("big_zombie_attack.png", 4, 2),
    "damaged": ("big_zombie_damaged.png", 4, 2),
}


def subject_mask(rgb: np.ndarray) -> np.ndarray:
    # The sources use a nearly-white background. Keeping a soft 18..45 range
    # retains antialiased edges without leaving a white halo.
    distance = 255 - rgb.min(axis=2)
    # A firmer threshold prevents pale JPEG/AI edge noise from joining the
    # character to the printed frame number below it.
    return distance > 40


def largest_subject(mask: np.ndarray) -> np.ndarray:
    """Keep the character and nearby debris, but discard printed frame numbers."""
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, list[tuple[int, int]]]] = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        queue = deque([(y, x)])
        seen[y, x] = True
        pixels: list[tuple[int, int]] = []
        while queue:
            cy, cx = queue.popleft()
            pixels.append((cy, cx))
            for ny in range(max(0, cy - 1), min(height, cy + 2)):
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    if mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        components.append((len(pixels), pixels))

    components.sort(reverse=True, key=lambda item: item[0])
    kept = np.zeros_like(mask, dtype=bool)
    if not components:
        return kept
    # The character and its cloth/limbs form one connected component. Keeping
    # only that component reliably removes the printed 1..8 labels and specks.
    for y, x in components[0][1]:
        kept[y, x] = True
    return kept


def extract_frame(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell.convert("RGBA")).copy()
    rgb = rgba[:, :, :3]
    mask = largest_subject(subject_mask(rgb))
    mask = np.asarray(
        Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)),
    ) > 0
    distance = (255 - rgb.min(axis=2)).astype(np.int16)
    alpha = np.zeros(distance.shape, dtype=np.uint8)
    core = largest_subject(subject_mask(rgb))
    fringe = mask & ~core
    alpha[fringe] = np.clip((distance[fringe] - 10) * 255 / 30, 0, 255).astype(np.uint8)
    alpha[core] = 255
    eroded_core = np.asarray(
        Image.fromarray(core.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5)),
    ) > 0
    edge = core & ~eroded_core
    low_saturation = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16) < 55
    pale_outline = edge & low_saturation & (rgb.min(axis=2) > 145)
    alpha[pale_outline] = np.minimum(alpha[pale_outline], 48)
    rgba[:, :, 3] = alpha

    ys, xs = np.nonzero(alpha > 8)
    if not len(xs):
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    cropped = Image.fromarray(rgba, "RGBA").crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # Match the arena's muted, weathered palette instead of retaining the
    # source contact sheet's bright golden saturation.
    cropped = ImageEnhance.Color(cropped).enhance(0.72)
    cropped = ImageEnhance.Brightness(cropped).enhance(0.88)
    cropped = ImageEnhance.Contrast(cropped).enhance(0.94)
    scale = min((FRAME_SIZE - 12) / cropped.width, TARGET_HEIGHT / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.alpha_composite(resized, ((FRAME_SIZE - resized.width) // 2, GROUND_Y - resized.height))
    return frame


def normalize(name: str, filename: str, columns: int, rows: int) -> None:
    source = Image.open(WALK_SOURCE if name == "walk" else SOURCE / filename).convert("RGBA")
    x_edges = [round(i * source.width / columns) for i in range(columns + 1)]
    y_edges = [round(i * source.height / rows) for i in range(rows + 1)]
    frames = []
    walk_crops: list[Image.Image] = []
    for row in range(rows):
        for column in range(columns):
            cell = source.crop((x_edges[column], y_edges[row], x_edges[column + 1], y_edges[row + 1]))
            if name == "walk":
                rgba = np.asarray(cell).copy()
                alpha = rgba[:, :, 3]
                subject = largest_subject(alpha > 64)
                subject = np.asarray(
                    Image.fromarray(subject.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)),
                ) > 0
                rgba[:, :, 3][~subject] = 0
                ys, xs = np.nonzero(rgba[:, :, 3] > 8)
                cropped = Image.fromarray(rgba, "RGBA").crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
                cropped = ImageEnhance.Color(cropped).enhance(0.72)
                cropped = ImageEnhance.Brightness(cropped).enhance(0.88)
                cropped = ImageEnhance.Contrast(cropped).enhance(0.94)
                walk_crops.append(cropped)
            else:
                frames.append(extract_frame(cell))

    if name == "walk":
        # One shared scale for the entire cycle. Per-frame fit-to-height made
        # the boss visibly grow and shrink whenever scarf/cape bounds changed.
        common_scale = min(
            (FRAME_SIZE - 12) / max(crop.width for crop in walk_crops),
            TARGET_HEIGHT / max(crop.height for crop in walk_crops),
        )
        for cropped in walk_crops:
            resized = cropped.resize(
                (max(1, round(cropped.width * common_scale)), max(1, round(cropped.height * common_scale))),
                Image.Resampling.LANCZOS,
            )
            frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
            frame.alpha_composite(resized, ((FRAME_SIZE - resized.width) // 2, GROUND_Y - resized.height))
            frames.append(frame)

    strip = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
    output = OUTPUT / f"big_zombie_{name}_strip.png"
    strip.save(output, optimize=True)
    print(f"{output.name}: {len(frames)} frames, {strip.width}x{strip.height}")
    if name == "damaged":
        hit_output = OUTPUT / "big_zombie_hit_strip.png"
        strip.crop((0, 0, FRAME_SIZE * 4, FRAME_SIZE)).save(hit_output, optimize=True)
        print(f"{hit_output.name}: 4 frames, {FRAME_SIZE * 4}x{FRAME_SIZE}")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for action, (filename, columns, rows) in SHEETS.items():
        normalize(action, filename, 4 if action == "walk" else columns, 3 if action == "walk" else rows)
