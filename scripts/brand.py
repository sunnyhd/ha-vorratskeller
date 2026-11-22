"""Erzeuge die Brand-Bilder unter custom_components/vorratskeller/brand.

Aufruf: python scripts/brand.py <Pfad zu Roboto.ttf>
Roboto (SIL Open Font License): https://github.com/google/fonts/tree/main/ofl/roboto

Vorgaben (home-assistant/brands): PNG, transparenter Hintergrund, beschnitten;
Icon quadratisch 256 und 512 px, Logo mit kürzester Seite 128-256 px (@2x 256-512 px).
"""

from __future__ import annotations

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont

ZIEL = Path(__file__).resolve().parent.parent / "custom_components" / "vorratskeller" / "brand"
S = 4  # Überabtastung für glatte Kanten

# Farben: Regal hell/dunkel, Vorräte in klaren Farben
HELL = {"regal": "#455A64", "text": "#263238"}
DUNKEL = {"regal": "#B0BEC5", "text": "#ECEFF1"}
GLAS = "#FFB300"  # Honig, Marmelade
DOSE = "#E53935"  # Tomaten
DECKEL = "#8D6E63"
FLASCHE = "#1E88E5"  # Wasser
SACK = "#7CB342"  # Linsen, Reis
WEISS = "#FFFFFF"


def rr(d: ImageDraw.ImageDraw, box, r, fill) -> None:
    d.rounded_rectangle([v * S for v in box], radius=r * S, fill=fill)


def regal(farben: dict[str, str]) -> Image.Image:
    """Regal mit Vorräten auf 512 × 512 (vor dem Beschneiden)."""
    img = Image.new("RGBA", (512 * S, 512 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = farben["regal"]
    # Pfosten und Böden
    rr(d, (40, 24, 76, 492), 10, c)
    rr(d, (436, 24, 472, 492), 10, c)
    for y in (176, 330, 470):
        rr(d, (40, y, 472, y + 26), 8, c)
    # Oberer Boden: drei Gläser
    for x, h in ((100, 120), (196, 96), (290, 132)):
        top = 176 - h
        rr(d, (x, top + 18, x + 84, 176), 16, GLAS)
        rr(d, (x - 4, top, x + 88, top + 26), 8, DECKEL)
        rr(d, (x + 16, top + 50, x + 68, top + 86), 6, WEISS)
    # Mittlerer Boden: Dosen und Flasche
    for x in (100, 194):
        rr(d, (x, 222, x + 84, 330), 10, DOSE)
        rr(d, (x, 244, x + 84, 254), 2, WEISS)
        rr(d, (x, 298, x + 84, 308), 2, WEISS)
    rr(d, (318, 196, 350, 226), 6, FLASCHE)
    rr(d, (296, 220, 372, 330), 22, FLASCHE)
    rr(d, (310, 252, 358, 290), 6, WEISS)
    # Unterer Boden: zwei Säcke
    for x, w in ((92, 150), (262, 150)):
        rr(d, (x, 372, x + w, 470), 26, SACK)
        rr(d, (x + 30, 362, x + w - 30, 384), 10, SACK)
        rr(d, (x + 40, 404, x + w - 40, 436), 6, WEISS)
    return img


def trimmen(img: Image.Image) -> Image.Image:
    return img.crop(img.getbbox())


def quadrat(img: Image.Image, kante: int) -> Image.Image:
    img = trimmen(img)
    seite = max(img.size)
    q = Image.new("RGBA", (seite, seite), (0, 0, 0, 0))
    q.paste(img, ((seite - img.width) // 2, (seite - img.height) // 2))
    return q.resize((kante, kante), Image.LANCZOS)


def logo(icon: Image.Image, farben: dict[str, str], font_path: str, hoehe: int) -> Image.Image:
    """Icon links, Schriftzug rechts; Höhe = kürzeste Seite."""
    h = hoehe * S
    ic = quadrat(icon, h)
    font = ImageFont.truetype(font_path, int(h * 0.42))
    font.set_variation_by_name("Medium")
    text = "Vorratskeller"
    links, oben, rechts, unten = font.getbbox(text)
    abstand = int(h * 0.18)
    img = Image.new("RGBA", (h + abstand + (rechts - links), h), (0, 0, 0, 0))
    img.paste(ic, (0, 0), ic)
    pos = (h + abstand - links, (h - (unten - oben)) // 2 - oben)
    ImageDraw.Draw(img).text(pos, text, font=font, fill=farben["text"])
    img = trimmen(img)
    faktor = hoehe / img.height
    return img.resize((round(img.width * faktor), hoehe), Image.LANCZOS)


def main() -> None:
    font_path = sys.argv[1]
    ZIEL.mkdir(parents=True, exist_ok=True)
    for prefix, farben in (("", HELL), ("dark_", DUNKEL)):
        bild = regal(farben)
        for suffix, kante in (("", 256), ("@2x", 512)):
            quadrat(bild, kante).save(ZIEL / f"{prefix}icon{suffix}.png", optimize=True)
            logo(bild, farben, font_path, kante // 2).save(
                ZIEL / f"{prefix}logo{suffix}.png", optimize=True
            )


if __name__ == "__main__":
    main()
