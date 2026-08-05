"""Extract normal-zombie actions from the supplied irregular contact sheet."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/img/create/normal_zombie_raw_striped_pattern.png"
WALK_SOURCE = ROOT / "public/assets/img/create/normal_zombie_walk_cycle_transparent.png"
OUTPUT = ROOT / "public/assets/img/monster"
FRAME_SIZE = 128
TARGET_HEIGHT = 116
GROUND_Y = 122

# The source is arranged as 4 idle cells, 8 walking cells, then two attack
# and three death poses. These boxes intentionally include generous whitespace;
# foreground extraction trims each pose before normalization.
ACTIONS: dict[str, list[tuple[int, int, int, int]]] = {
    "idle": [(i * 200, 0, (i + 1) * 200, 330) for i in range(4)],
    "walk": [(round(i * 1684 / 8), 320, round((i + 1) * 1684 / 8), 635) for i in range(8)],
    "attack": [(0, 625, 260, 934), (245, 625, 520, 934)],
    "death": [(500, 625, 750, 934), (740, 625, 980, 934), (930, 625, 1340, 934)],
}


def largest_component(mask: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best: list[tuple[int, int]] = []
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
        if len(pixels) > len(best):
            best = pixels
    result = np.zeros_like(mask, dtype=bool)
    for y, x in best:
        result[y, x] = True
    return result


def extract(box: tuple[int, int, int, int]) -> Image.Image:
    rgba = np.asarray(Image.open(SOURCE).convert("RGBA").crop(box)).copy()
    rgb = rgba[:, :, :3]
    distance = (255 - rgb.min(axis=2)).astype(np.int16)
    solid = largest_component(distance > 38)
    keep = np.asarray(
        Image.fromarray(solid.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)),
    ) > 0
    # The sprite body must stay fully opaque. Only the two-pixel dilation ring
    # receives a soft matte for antialiased edges; deriving all alpha from
    # brightness makes the zombie's naturally pale skin/clothes translucent.
    alpha = np.zeros(distance.shape, dtype=np.uint8)
    fringe = keep & ~solid
    alpha[fringe] = np.clip((distance[fringe] - 10) * 255 / 28, 0, 255).astype(np.uint8)
    alpha[solid] = 255
    rgba[:, :, 3] = alpha

    ys, xs = np.nonzero(alpha > 8)
    if not len(xs):
        raise RuntimeError(f"No foreground found in crop {box}")
    sprite = Image.fromarray(rgba, "RGBA").crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = min((FRAME_SIZE - 6) / sprite.width, TARGET_HEIGHT / sprite.height)
    sprite = sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.alpha_composite(sprite, ((FRAME_SIZE - sprite.width) // 2, GROUND_Y - sprite.height))
    return frame


def normalize_transparent_sprite(cell: Image.Image) -> Image.Image:
    alpha = np.asarray(cell.getchannel("A"))
    ys, xs = np.nonzero(alpha > 8)
    if not len(xs):
        raise RuntimeError("No foreground found in generated walk-cycle cell")
    sprite = cell.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = min((FRAME_SIZE - 6) / sprite.width, TARGET_HEIGHT / sprite.height)
    sprite = sprite.resize(
        (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
        Image.Resampling.LANCZOS,
    )
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
    frame.alpha_composite(sprite, ((FRAME_SIZE - sprite.width) // 2, GROUND_Y - sprite.height))
    return frame


def generated_walk_frames() -> list[Image.Image]:
    source = Image.open(WALK_SOURCE).convert("RGBA")
    columns, rows = 4, 2
    x_edges = [round(i * source.width / columns) for i in range(columns + 1)]
    y_edges = [round(i * source.height / rows) for i in range(rows + 1)]
    return [
        normalize_transparent_sprite(source.crop((x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1])))
        for row in range(rows)
        for col in range(columns)
    ]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for action, boxes in ACTIONS.items():
        frames = generated_walk_frames() if action == "walk" else [extract(box) for box in boxes]
        strip = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE))
        for index, frame in enumerate(frames):
            strip.alpha_composite(frame, (index * FRAME_SIZE, 0))
        path = OUTPUT / f"normal_zombie_{action}_strip.png"
        strip.save(path, optimize=True)
        print(f"{path.name}: {len(frames)} frames, {strip.width}x{strip.height}")


if __name__ == "__main__":
    main()
