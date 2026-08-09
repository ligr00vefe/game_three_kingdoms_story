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


if __name__ == "__main__":
    rebuild_glaive()
    rebuild_dragon()
