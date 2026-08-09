"""Repack skill presentation sheets into fixed, game-ready sprite frames."""
from pathlib import Path
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "img" / "fx"


def alpha_bbox_and_centroid(image: Image.Image):
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > 20 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return None, (image.width / 2, image.height / 2)
    total = sum_x = sum_y = 0
    pixels = alpha.load()
    for y in range(image.height):
        for x in range(image.width):
            value = pixels[x, y]
            if value > 20:
                total += value
                sum_x += x * value
                sum_y += y * value
    return bbox, (sum_x / total, sum_y / total)


def repack_blue_dragon():
    source = Image.open(ROOT / "skill_blue_dragon_slash.png").convert("RGBA")
    frame_w, frame_h, count = 256, 648, 10
    output = Image.new("RGBA", (frame_w * count, frame_h))
    for index in range(count):
        left = round(index * source.width / count)
        right = round((index + 1) * source.width / count)
        frame = source.crop((left, 0, right, frame_h))
        pixels = frame.load()
        for x in list(range(min(3, frame.width))) + list(range(max(0, frame.width - 3), frame.width)):
            for y in range(frame.height):
                pixels[x, y] = (0, 0, 0, 0)
        for x in range(frame.width):
            straight_line = sum(
                1 for y in range(frame.height)
                if pixels[x, y][3] > 180 and max(pixels[x, y][:3]) - min(pixels[x, y][:3]) < 10
            )
            if straight_line > frame.height * 0.45:
                for y in range(frame.height):
                    pixels[x, y] = (0, 0, 0, 0)
        output.alpha_composite(frame, (index * frame_w + (frame_w - frame.width) // 2, 0))
    output.save(ROOT / "skill_blue_dragon_slash_fixed.png")


def repack_glaive():
    source = Image.open(ROOT / "skill_crescent_moon_dance.png").convert("RGBA")
    frame_w = frame_h = 384
    frames = []
    row_specs = [
        (0, 300, [128, 431, 744, 1047, 1350]),
        (300, 610, [144, 432, 720, 1008, 1320]),
        (610, 1024, [192, 560, 1110]),
    ]
    for row, (row_top, row_bottom, centers) in enumerate(row_specs):
        for col, center in enumerate(centers):
            left = 0 if col == 0 else round((centers[col - 1] + center) / 2)
            right = source.width if col == len(centers) - 1 else round((center + centers[col + 1]) / 2)
            frame = source.crop((left, row_top, right, row_bottom))
            canvas = Image.new("RGBA", (frame_w, frame_h))
            y = 20 if row < 2 else frame_h - frame.height
            canvas.alpha_composite(frame, (round(frame_w / 2 - (center - left)), y))
            frames.append(canvas)

    output = Image.new("RGBA", (frame_w * 5, frame_h * 3))
    for index, frame in enumerate(frames):
        output.alpha_composite(frame, ((index % 5) * frame_w, (index // 5) * frame_h))
    output.save(ROOT / "skill_crescent_moon_dance_fixed_v3.png")


def repack_decisive():
    source = Image.open(ROOT / "effect_a_single_decisive_blow.png").convert("RGBA")
    centers = [
        [96, 294, 510, 744, 1020, 1318],
        [127, 358, 574, 806, 1027, 1318],
        [128, 389, 660, 929, 1189, 1412],
    ]
    frame_w, frame_h = 384, 360
    output = Image.new("RGBA", (frame_w * 6, frame_h * 3))
    for row, row_centers in enumerate(centers):
        row_top = 0 if row == 0 else 341 if row == 1 else 682
        row_bottom = 341 if row == 0 else 682 if row == 1 else 1024
        for col, center in enumerate(row_centers):
            left = 0 if col == 0 else round((row_centers[col - 1] + center) / 2)
            right = source.width if col == 5 else round((center + row_centers[col + 1]) / 2)
            frame = source.crop((left, row_top, right, row_bottom))
            # Presentation-sheet frame number; actual effects begin below it.
            frame.paste((0, 0, 0, 0), (0, 0, frame.width, min(58, frame.height)))
            output.alpha_composite(
                frame,
                (col * frame_w + round(frame_w / 2 - (center - left)), row * frame_h + 9),
            )
    output.save(ROOT / "effect_a_single_decisive_blow_fixed_v2.png")


if __name__ == "__main__":
    repack_blue_dragon()
    repack_glaive()
    repack_decisive()
