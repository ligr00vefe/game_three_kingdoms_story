"""Normalize the three irregular bomb-zombie contact sheets into Phaser strips."""

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/img/monster"
OUTPUT_SIZE = 256
# The source sheets were authored at different apparent character sizes.
# Apply one constant factor per animation (never per frame) so poses do not
# pulse in size and idle/walk/throwing share the same on-screen proportions.
ANIMATION_SCALE = {"idle": 0.82, "walk": 1.06, "throwing": 0.82}


def keep_largest_component(frame: Image.Image) -> Image.Image:
    """Discard neighboring-frame slivers that cross an irregular grid boundary."""
    width, height = frame.size
    alpha = bytearray(frame.getchannel("A").tobytes())
    unseen = bytearray(value > 16 for value in alpha)
    largest: list[int] = []
    for seed in range(width * height):
        if not unseen[seed]:
            continue
        unseen[seed] = 0
        stack = [seed]
        component: list[int] = []
        while stack:
            index = stack.pop()
            component.append(index)
            x = index % width
            for neighbor in (index - width, index + width, index - 1, index + 1):
                if neighbor < 0 or neighbor >= width * height or not unseen[neighbor]:
                    continue
                if neighbor == index - 1 and x == 0 or neighbor == index + 1 and x == width - 1:
                    continue
                unseen[neighbor] = 0
                stack.append(neighbor)
        if len(component) > len(largest):
            largest = component
    keep = bytearray(width * height)
    for index in largest:
        keep[index] = alpha[index]
    frame.putalpha(Image.frombytes("L", frame.size, bytes(keep)))
    return frame


def fitted_frame(
    source: Image.Image,
    box: tuple[int, int, int, int],
    animation: str,
    clean_grid: bool = False,
    pose_scale: float = 1.0,
) -> Image.Image:
    frame = source.crop(box)
    if clean_grid:
        frame = keep_largest_component(frame)
    alpha_box = frame.getchannel("A").getbbox()
    if alpha_box:
        frame = frame.crop(alpha_box)
    max_w, max_h = 238, 246
    ratio = min(max_w / frame.width, max_h / frame.height)
    ratio *= ANIMATION_SCALE[animation] * pose_scale
    frame = frame.resize((round(frame.width * ratio), round(frame.height * ratio)), Image.Resampling.LANCZOS)
    # Resampling can expose transparent padding/noise that was part of the raw
    # crop. Re-crop the final visible pixels so every frame's actual feet—not
    # its source cell boundary—lands on the exact same baseline.
    visible_box = frame.getchannel("A").getbbox()
    if visible_box:
        frame = frame.crop(visible_box)
    canvas = Image.new("RGBA", (OUTPUT_SIZE, OUTPUT_SIZE))
    canvas.alpha_composite(frame, ((OUTPUT_SIZE - frame.width) // 2, OUTPUT_SIZE - frame.height))
    return canvas


def save_grid(name: str, columns: int, rows: int) -> None:
    source = Image.open(SOURCE / f"bomb_zombie_{name}.png").convert("RGBA")
    frames = []
    for row in range(rows):
        for column in range(columns):
            left = round(column * source.width / columns)
            right = round((column + 1) * source.width / columns)
            top = round(row * source.height / rows)
            bottom = round((row + 1) * source.height / rows)
            frames.append(fitted_frame(source, (left, top, right, bottom), name, clean_grid=name == "idle"))
    # The source's final three idle cells are truncated at the right canvas edge.
    if name == "idle":
        frames = frames[:17]
    save_strip(name, frames)


def save_throwing() -> None:
    source = Image.open(SOURCE / "bomb_zombie_throwing.png").convert("RGBA")
    # The throwing sheet uses variable-width frames, separated by transparent gutters.
    spans = [
        (30, 326), (345, 562), (634, 1007), (1061, 1359), (1428, 1818),
        (1845, 2062), (2078, 2298), (2325, 2522), (2546, 2734), (2758, 2972),
        (2972, 3180), (3184, 3376), (3398, 3588), (3616, 3808), (3834, 4050),
    ]
    # Source order contains an unrelated kick first and the pickup/throw poses
    # out of sequence. Play: bend/pick up -> hold -> wind up -> throw -> follow-through.
    ordered = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 1, 2, 3, 4]
    frames = []
    for output_index, source_index in enumerate(ordered):
        # The final throw poses were drawn with a visibly smaller zombie body.
        # Enlarge those poses as a group while retaining a fixed scale within
        # the pickup and throw phases respectively.
        pose_scale = 1.08 if output_index >= 10 else 1.0
        frames.append(fitted_frame(
            source,
            (spans[source_index][0], 0, spans[source_index][1], source.height),
            "throwing",
            pose_scale=pose_scale,
        ))
    save_strip("throwing", frames)


def save_strip(name: str, frames: list[Image.Image]) -> None:
    strip = Image.new("RGBA", (OUTPUT_SIZE * len(frames), OUTPUT_SIZE))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * OUTPUT_SIZE, 0))
    strip.save(SOURCE / f"bomb_zombie_{name}_strip.png", optimize=True)


if __name__ == "__main__":
    save_grid("idle", 10, 2)
    save_grid("walk", 6, 1)
    save_throwing()
