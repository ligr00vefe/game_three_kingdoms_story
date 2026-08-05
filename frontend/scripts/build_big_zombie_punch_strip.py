from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "public/assets/img/monster/big_zombie_punch_strip.png"
REPAIRS = ROOT / "public/assets/img/monster/big_zombie_punch_fix_alpha.png"
OUTPUT = ROOT / "public/assets/img/monster/big_zombie_punch_fixed_strip.png"
FRAME_WIDTH = 320
FRAME_HEIGHT = 256


def largest_component_bbox(alpha: Image.Image) -> tuple[int, int, int, int] | None:
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or pixels[x, y] <= 12:
                continue
            visited[offset] = 1
            queue = deque([(x, y)])
            component: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    neighbor = ny * width + nx
                    if visited[neighbor] or pixels[nx, ny] <= 12:
                        continue
                    visited[neighbor] = 1
                    queue.append((nx, ny))
            if len(component) > len(largest):
                largest = component
    if not largest:
        return None
    xs = [point[0] for point in largest]
    ys = [point[1] for point in largest]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def normalized_actor(cell: Image.Image) -> Image.Image:
    bbox = largest_component_bbox(cell.getchannel("A"))
    if bbox is None:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    actor = cell.crop(bbox)
    scale = min(220 / actor.height, 292 / actor.width)
    return actor.resize(
        (max(1, round(actor.width * scale)), max(1, round(actor.height * scale))),
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    original = Image.open(ORIGINAL).convert("RGBA")
    repairs = Image.open(REPAIRS).convert("RGBA")
    frames: list[Image.Image] = []
    for index in range(6):
        if index in (2, 3):
            left = round((index - 2) * repairs.width / 2)
            right = round((index - 1) * repairs.width / 2)
            cell = repairs.crop((left, 0, right, repairs.height))
        else:
            cell = original.crop((index * 256, 0, (index + 1) * 256, 256))
        frames.append(normalized_actor(cell))

    strip = Image.new("RGBA", (FRAME_WIDTH * len(frames), FRAME_HEIGHT), (0, 0, 0, 0))
    for index, actor in enumerate(frames):
        x = index * FRAME_WIDTH + (FRAME_WIDTH - actor.width) // 2
        strip.alpha_composite(actor, (x, 244 - actor.height))
    strip.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({strip.width}x{strip.height})")


if __name__ == "__main__":
    main()
