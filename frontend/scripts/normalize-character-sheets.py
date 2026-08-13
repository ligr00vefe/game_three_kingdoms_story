"""Build game sheets from independently spaced character poses.

Frames are detected from transparent horizontal gaps, never by equal division.
Every pose uses one fixed scale so Guan Yu remains the same apparent size even
when a jump or slash has a much larger weapon envelope.
"""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/img/sample"
OUTPUT = ROOT / "public/assets/img/char"
FRAME = 192
ALPHA_THRESHOLD = 8
INTERNAL_GAP = 35
SOURCE_SCALE = 0.34
ACTION_SCALE = {"slash_l": 0.29, "slash_r": 0.29}
BOTTOM_MARGIN = 8

EXPECTED_FRAMES = {
    "idle_l": 6, "idle_r": 6,
    "walk_l": 8, "walk_r": 8,
    "jump_l": 6, "jump_r": 6,
    "climb": 6,
    "attack_l": 6, "attack_r": 6,
    "slash_l": 6, "slash_r": 6,
}


def occupied_runs(image: Image.Image) -> list[tuple[int, int]]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return []
    active = []
    for x in range(bbox[0], bbox[2]):
        active.append(any(alpha.getpixel((x, y)) >= ALPHA_THRESHOLD for y in range(bbox[1], bbox[3])))

    runs: list[tuple[int, int]] = []
    start = None
    for offset, on in enumerate(active + [False]):
        x = bbox[0] + offset
        if on and start is None:
            start = x
        elif not on and start is not None:
            if runs and start - runs[-1][1] < INTERNAL_GAP:
                runs[-1] = (runs[-1][0], x)
            else:
                runs.append((start, x))
            start = None
    return runs


def normalize(source: Path, destination: Path, expected: int, scale: float) -> None:
    image = Image.open(source).convert("RGBA")
    runs = occupied_runs(image)
    if len(runs) != expected:
        raise ValueError(f"{source.name}: detected {len(runs)} poses, expected {expected}: {runs}")

    poses: list[Image.Image] = []
    for left, right in runs:
        cell = image.crop((left, 0, right, image.height))
        bbox = cell.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"{source.name}: empty pose at {left}:{right}")
        poses.append(cell.crop(bbox))

    scaled = [
        pose.resize(
            (max(1, round(pose.width * scale)), max(1, round(pose.height * scale))),
            Image.Resampling.LANCZOS,
        )
        for pose in poses
    ]
    if any(pose.width > FRAME or pose.height > FRAME - BOTTOM_MARGIN for pose in scaled):
        sizes = [pose.size for pose in scaled]
        raise ValueError(f"{source.name}: pose exceeds {FRAME}px canvas at fixed scale: {sizes}")

    strip = Image.new("RGBA", (FRAME * expected, FRAME))
    for index, pose in enumerate(scaled):
        x = index * FRAME + (FRAME - pose.width) // 2
        y = FRAME - BOTTOM_MARGIN - pose.height
        strip.alpha_composite(pose, (x, y))
    destination.parent.mkdir(parents=True, exist_ok=True)
    strip.save(destination, optimize=True)


def main() -> None:
    for action, expected in EXPECTED_FRAMES.items():
        normalize(
            SOURCE / f"guanwu_t2_{action}.png",
            OUTPUT / f"guanwu_t2_{action}.png",
            expected,
            ACTION_SCALE.get(action, SOURCE_SCALE),
        )


if __name__ == "__main__":
    main()
