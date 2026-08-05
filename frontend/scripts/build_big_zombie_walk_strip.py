from pathlib import Path
from collections import deque

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/img/monster/big_zombie_walk_16_alpha.png"
OUTPUT = ROOT / "public/assets/img/monster/big_zombie_walk_16_strip.png"
FRAME_SIZE = 256
FRAME_COUNT = 16


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


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    strip = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))

    for index in range(FRAME_COUNT):
        col = index % 4
        row = index // 4
        left = round(col * source.width / 4)
        right = round((col + 1) * source.width / 4)
        top = round(row * source.height / 4)
        bottom = round((row + 1) * source.height / 4)
        cell = source.crop((left, top, right, bottom))
        bbox = largest_component_bbox(cell.getchannel("A"))
        if bbox is None:
            continue

        actor = cell.crop(bbox)
        scale = min(222 / actor.height, 226 / actor.width)
        actor = actor.resize(
            (max(1, round(actor.width * scale)), max(1, round(actor.height * scale))),
            Image.Resampling.LANCZOS,
        )
        x = index * FRAME_SIZE + (FRAME_SIZE - actor.width) // 2
        y = 240 - actor.height
        strip.alpha_composite(actor, (x, y))

    strip.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({strip.width}x{strip.height})")


if __name__ == "__main__":
    main()
