"""Rebuild skill sheets from their source panels without cross-frame clipping."""
from pathlib import Path
from PIL import Image

FX = Path(__file__).resolve().parents[1] / "public" / "assets" / "img" / "fx"


def black_to_alpha(image: Image.Image) -> Image.Image:
    # The source already contains a carefully feathered alpha channel.
    return image.convert("RGBA")


def white_to_alpha(image: Image.Image) -> Image.Image:
    # White RGB values remain under fully transparent source pixels; preserve
    # the authored alpha instead of deriving a noisy matte from hidden RGB.
    return image.convert("RGBA")


def paste_bottom_center(sheet: Image.Image, frame: Image.Image, index: int, cell_w: int, cell_h: int) -> None:
    alpha_bounds = frame.getchannel("A").getbbox()
    if alpha_bounds is None:
        return
    x = index % 5 * cell_w + (cell_w - frame.width) // 2
    # Align the lowest *visible* pixel, not the source crop/canvas edge, to
    # the frame's ground line. This keeps every glaive arc around the player
    # and every impact frame physically on the road/platform.
    y = index // 5 * cell_h + cell_h - alpha_bounds[3]
    sheet.alpha_composite(frame, (x, y))


def rebuild_glaive() -> None:
    src = Image.open(FX / "skill_crescent_moon_dance.png")
    cell_w, cell_h = 896, 420
    sheet = Image.new("RGBA", (cell_w * 5, cell_h * 3))
    x_edges = [round(i * src.width / 5) for i in range(6)]
    y_edges = [0, 330, 650]
    for row in range(2):
        for col in range(5):
            frame = black_to_alpha(src.crop((x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1])))
            paste_bottom_center(sheet, frame, row * 5 + col, cell_w, cell_h)

    # The three impact panels deliberately have different widths. In
    # particular the final blast keeps its original ~2x radius and receives
    # enough transparent canvas on both sides instead of being squeezed.
    impact_boxes = [(0, 650, 384, 1024), (384, 650, 768, 1024), (768, 650, 1536, 1024)]
    for i, box in enumerate(impact_boxes, start=10):
        paste_bottom_center(sheet, black_to_alpha(src.crop(box)), i, cell_w, cell_h)
    # fixed_v5 is now a hand-corrected authoritative asset. Never overwrite it
    # from this legacy contact-sheet extractor.

    # The source is an overlapping contact sheet, not a true uniform grid.
    # Keep frames 1-12 from the established fixed_v3 sheet and export only the
    # oversized final blast separately so it never needs a 384 px crop.
    final_frame = black_to_alpha(src.crop((768, 650, 1536, 1024)))
    final_canvas = Image.new("RGBA", (896, 420))
    bounds = final_frame.getchannel("A").getbbox()
    if bounds is not None:
        final_canvas.alpha_composite(final_frame, ((896 - final_frame.width) // 2, 420 - bounds[3]))
    final_canvas.save(FX / "skill_crescent_moon_dance_final.png", optimize=True)


def rebuild_dragon() -> None:
    src = Image.open(FX / "skill_blue_dragon_slash_fixed.png").convert("RGBA")
    cell_w, cell_h = 320, 648
    sheet = Image.new("RGBA", (cell_w * 10, cell_h))
    for i in range(10):
        frame = src.crop((i * 256, 0, (i + 1) * 256, 648))
        # The previous sheet retained pale one-pixel panel separators. Remove
        # only those border columns, then add 32 px of transparent side room.
        frame.paste((0, 0, 0, 0), (0, 0, 4, frame.height))
        frame.paste((0, 0, 0, 0), (frame.width - 4, 0, frame.width, frame.height))
        y = 0
        if i >= 7:
            bounds = frame.getchannel("A").getbbox()
            if bounds is not None:
                y = cell_h - bounds[3]
        sheet.alpha_composite(frame, (i * cell_w + (cell_w - frame.width) // 2, y))
    sheet.save(FX / "skill_blue_dragon_slash_fixed_v3.png", optimize=True)


def occupied_x_runs(image: Image.Image, alpha_threshold: int = 8, min_gap: int = 4) -> list[tuple[int, int]]:
    """Find pose boundaries from transparent columns instead of equal-width cells."""
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return []
    occupied = [
        any(alpha.getpixel((x, y)) > alpha_threshold for y in range(bbox[1], bbox[3]))
        for x in range(bbox[0], bbox[2])
    ]
    runs: list[tuple[int, int]] = []
    start: int | None = None
    gap = 0
    for offset, active in enumerate(occupied + [False] * min_gap):
        x = bbox[0] + offset
        if active:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, x - gap + 1))
                start = None
                gap = 0
    return runs


def rebuild_zhao_dragon_fang() -> None:
    """Pack eight irregular Dragon Fang Flash cuts without scaling or clipping."""
    src = Image.open(FX / "skill_dragons_fang_flash.png").convert("RGBA")
    runs = occupied_x_runs(src)
    if len(runs) != 8:
        raise ValueError(f"skill_dragons_fang_flash.png: detected {len(runs)} cuts, expected 8: {runs}")

    cell_w, cell_h = 438, src.height
    side_padding = 8
    sheet = Image.new("RGBA", (cell_w * len(runs), cell_h))
    for index, (left, right) in enumerate(runs):
        crop_left = max(0, left - side_padding)
        crop_right = min(src.width, right + side_padding)
        frame = src.crop((crop_left, 0, crop_right, cell_h))
        if frame.width > cell_w:
            raise ValueError(f"Dragon Fang frame {index} is {frame.width}px, wider than {cell_w}px")
        x = index * cell_w + (cell_w - frame.width) // 2
        sheet.alpha_composite(frame, (x, 0))
    sheet.save(FX / "skill_dragons_fang_flash_fixed.png", optimize=True)


def pack_irregular_horizontal(
    source_name: str, output_name: str, expected: int, cell_w: int, bottom_align: bool = False,
) -> None:
    """Center variable-width alpha-separated cuts in equal animation cells."""
    src = Image.open(FX / source_name).convert("RGBA")
    runs = occupied_x_runs(src)
    if len(runs) != expected:
        raise ValueError(f"{source_name}: detected {len(runs)} cuts, expected {expected}: {runs}")

    side_padding = 8
    sheet = Image.new("RGBA", (cell_w * expected, src.height))
    for index, (left, right) in enumerate(runs):
        crop_left = max(0, left - side_padding)
        crop_right = min(src.width, right + side_padding)
        frame = src.crop((crop_left, 0, crop_right, src.height))
        if frame.width > cell_w:
            raise ValueError(f"{source_name} frame {index} is {frame.width}px, wider than {cell_w}px")
        x = index * cell_w + (cell_w - frame.width) // 2
        bounds = frame.getchannel("A").getbbox()
        y = src.height - bounds[3] if bottom_align and bounds is not None else 0
        sheet.alpha_composite(frame, (x, y))
    sheet.save(FX / output_name, optimize=True)


def pack_explicit_horizontal(
    source_name: str,
    output_name: str,
    ranges: list[tuple[int, int]],
    cell_w: int,
    bottom_align: bool = False,
    center_visible_y: bool = False,
) -> None:
    """Pack visually separated cuts whose feathered glows touch at the boundary."""
    src = Image.open(FX / source_name).convert("RGBA")
    sheet = Image.new("RGBA", (cell_w * len(ranges), src.height))
    for index, (left, right) in enumerate(ranges):
        frame = src.crop((left, 0, right, src.height))
        if frame.width > cell_w:
            raise ValueError(f"{source_name} frame {index} is {frame.width}px, wider than {cell_w}px")
        bounds = frame.getchannel("A").getbbox()
        if center_visible_y and bounds is not None:
            visible_h = bounds[3] - bounds[1]
            y = (src.height - visible_h) // 2 - bounds[1]
        else:
            y = src.height - bounds[3] if bottom_align and bounds is not None else 0
        x = index * cell_w + (cell_w - frame.width) // 2
        sheet.alpha_composite(frame, (x, y))
    sheet.save(FX / output_name, optimize=True)


def rebuild_hundred_flower() -> None:
    pack_irregular_horizontal(
        "effect_one_hundred_flower_blooming_in_succession.png",
        "effect_one_hundred_flower_blooming_in_succession_fixed.png",
        expected=7,
        cell_w=438,
        bottom_align=True,
    )
    # 9 authored phases: right slash 3, left slash 3, right thrust 3.
    # Center each visible cut vertically so the runtime can anchor its actual
    # effect center directly to Zhao Yun's spear height.
    pack_explicit_horizontal(
        "skill_one_hundred_flower_blooming_in_succession.png",
        "skill_one_hundred_flower_blooming_in_succession_fixed.png",
        ranges=[
            (0, 194), (194, 411), (411, 672),
            (672, 848), (848, 1070), (1070, 1325),
            (1325, 1586), (1586, 1862), (1862, 2172),
        ],
        cell_w=328,
        center_visible_y=True,
    )


def rebuild_tiger_tears() -> None:
    # Ten phases. Frames 7-9 have touching feathered glows, so their visual
    # valleys are supplied explicitly instead of merging them into one cut.
    pack_explicit_horizontal(
        "skill_a_tiger_tears_the_sky.png",
        "skill_a_tiger_tears_the_sky_fixed.png",
        ranges=[
            (0, 179), (179, 375), (375, 616), (616, 859), (859, 1079),
            (1079, 1323), (1323, 1587), (1587, 1793), (1793, 1982), (1982, 2172),
        ],
        cell_w=280,
        bottom_align=True,
    )


def pack_explicit_grid(
    source_name: str,
    output_name: str,
    boxes: list[tuple[int, int, int, int]],
    cell_w: int,
    cell_h: int,
) -> None:
    """Pack hand-inspected, variable-sized grid panels on one bottom-aligned strip."""
    src = Image.open(FX / source_name).convert("RGBA")
    sheet = Image.new("RGBA", (cell_w * len(boxes), cell_h))
    for index, box in enumerate(boxes):
        frame = src.crop(box)
        if frame.width > cell_w or frame.height > cell_h:
            raise ValueError(f"{source_name} frame {index} ({frame.size}) exceeds cell {(cell_w, cell_h)}")
        bounds = frame.getchannel("A").getbbox()
        x = index * cell_w + (cell_w - frame.width) // 2
        y = cell_h - bounds[3] if bounds is not None else 0
        sheet.alpha_composite(frame, (x, y))
    sheet.save(FX / output_name, optimize=True)


def rebuild_lubu_advanced_skills() -> None:
    # These two sources are 5 x 2 contact sheets, but every authored panel has
    # a different width. The boundaries follow the transparent valleys so no
    # fire, chain, or portal pixels are borrowed from a neighbouring frame.
    pack_explicit_grid(
        "skill_shake_the_sky_explode_and_shatter.png",
        "skill_shake_the_sky_explode_and_shatter_fixed.png",
        boxes=[
            (0, 0, 340, 362), (340, 0, 680, 362), (680, 0, 1120, 362),
            (1120, 0, 1560, 362), (1560, 0, 2172, 362),
            (0, 362, 490, 724), (490, 362, 1015, 724), (1015, 362, 1457, 724),
            (1457, 362, 1885, 724), (1885, 362, 2172, 724),
        ],
        cell_w=640,
        cell_h=400,
    )
    pack_explicit_grid(
        "skill_annihilation_of_heaven_and_earth.png",
        "skill_annihilation_of_heaven_and_earth_fixed.png",
        boxes=[
            (0, 0, 170, 724), (170, 0, 330, 724), (330, 0, 480, 724),
            (480, 0, 700, 724), (700, 0, 1020, 724), (1020, 0, 1486, 724),
            (1486, 0, 1715, 724), (1715, 0, 1896, 724),
            (1896, 0, 2036, 724), (2036, 0, 2172, 724),
        ],
        cell_w=480,
        cell_h=724,
    )
    pack_explicit_grid(
        "skill_ghost_gate_chain.png",
        "skill_ghost_gate_chain_fixed.png",
        boxes=[
            (0, 0, 334, 362), (334, 0, 721, 362), (721, 0, 1105, 362),
            (1105, 0, 1657, 362), (1657, 0, 2172, 362),
            (0, 362, 453, 724), (453, 362, 1000, 724), (1000, 362, 1460, 724),
            (1460, 362, 1865, 724), (1865, 362, 2172, 724),
        ],
        cell_w=576,
        cell_h=400,
    )


if __name__ == "__main__":
    rebuild_glaive()
    rebuild_dragon()
    rebuild_zhao_dragon_fang()
    rebuild_hundred_flower()
    rebuild_tiger_tears()
    rebuild_lubu_advanced_skills()
