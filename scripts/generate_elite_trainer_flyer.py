from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import Paragraph
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "Route25_Elite_Trainer_Flyer_April_2026.pdf"

PAGE_W, PAGE_H = letter


def hex_color(value: str):
    return colors.HexColor(value)


INK = hex_color("#111827")
MUTED = hex_color("#4B5563")
PURPLE = hex_color("#6F7DFF")
VIOLET = hex_color("#8A5DFF")
CYAN = hex_color("#58C7FF")
MINT = hex_color("#31D0AA")
YELLOW = hex_color("#FFCF5A")
PINK = hex_color("#FF6FAE")
LIGHT = hex_color("#F8FAFF")


def draw_wrapped(c, text, x, y, w, h, size=10.5, leading=13, color=INK, bold=False, align="LEFT"):
    style = ParagraphStyle(
        "body",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment={"LEFT": 0, "CENTER": 1, "RIGHT": 2}[align],
        spaceAfter=0,
        spaceBefore=0,
    )
    p = Paragraph(text, style)
    _, used_h = p.wrap(w, h)
    p.drawOn(c, x, y + h - used_h)
    return used_h


def pill(c, text, x, y, pad_x=10, pad_y=5, fill=PURPLE, text_color=colors.white, size=8.5):
    width = stringWidth(text, "Helvetica-Bold", size) + pad_x * 2
    height = size + pad_y * 2
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, height / 2, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x + pad_x, y + pad_y + 1.2, text)
    return width


def bubble(c, x, y, w, h, fill, stroke, title, body, title_color=INK, tail="left", label=None):
    c.saveState()
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 18, fill=1, stroke=1)

    if tail == "left":
        c.circle(x + 20, y - 5, 7, fill=1, stroke=1)
        c.circle(x + 8, y - 17, 4, fill=1, stroke=1)
    elif tail == "right":
        c.circle(x + w - 22, y - 5, 7, fill=1, stroke=1)
        c.circle(x + w - 8, y - 17, 4, fill=1, stroke=1)
    elif tail == "top":
        c.circle(x + w - 35, y + h + 5, 7, fill=1, stroke=1)
        c.circle(x + w - 18, y + h + 17, 4, fill=1, stroke=1)

    if label:
        pill(c, label, x + 14, y + h - 25, fill=stroke, size=7.5)
        title_y_offset = 32
    else:
        title_y_offset = 16

    draw_wrapped(c, title, x + 16, y + h - title_y_offset - 20, w - 32, 22, size=14, leading=16, bold=True, color=title_color)
    draw_wrapped(c, body, x + 16, y + 15, w - 32, h - title_y_offset - 34, size=9.3, leading=12.1, color=MUTED)
    c.restoreState()


def check_item(c, x, y, text, accent=PURPLE):
    c.setFillColor(accent)
    c.circle(x + 5, y + 5, 5, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x + 5, y + 2.6, "✓")
    draw_wrapped(c, text, x + 17, y - 1, 145, 18, size=8.7, leading=10.5, color=INK)


def draw_header(c):
    c.setFillColor(hex_color("#07111F"))
    c.rect(0, PAGE_H - 168, PAGE_W, 168, fill=1, stroke=0)
    c.setFillColor(hex_color("#0D1B33"))
    c.circle(PAGE_W - 70, PAGE_H - 66, 90, fill=1, stroke=0)
    c.setFillColor(hex_color("#111B44"))
    c.circle(62, PAGE_H - 130, 68, fill=1, stroke=0)

    icon = ASSETS / "Icon.png"
    if icon.exists():
        c.drawImage(str(icon), 42, PAGE_H - 90, 42, 42, preserveAspectRatio=True, mask="auto")

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(94, PAGE_H - 63, "Route 25")
    pill(c, "ELITE TRAINER PROGRAM", 94, PAGE_H - 88, fill=CYAN, text_color=hex_color("#06111F"), size=8)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(42, PAGE_H - 120, "Turn your pulls into influence.")
    c.setFont("Helvetica", 12)
    c.setFillColor(hex_color("#DCE7FF"))
    c.drawString(44, PAGE_H - 140, "A low-effort, community-first partner program for Pokémon TCG collectors.")


def draw_footer(c):
    c.setFillColor(hex_color("#07111F"))
    c.roundRect(42, 28, PAGE_W - 84, 44, 18, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(61, 54, "Ready to help shape Route 25?")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(hex_color("#DCE7FF"))
    c.drawString(61, 39, "Post naturally, trade often, share authentically, and send feedback directly to the Route 25 team.")
    pill(c, "April 2026", PAGE_W - 137, 43, fill=YELLOW, text_color=hex_color("#1F2937"), size=8.5)


def build():
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Route 25 Elite Trainer Flyer - April 2026")

    c.setFillColor(LIGHT)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_header(c)

    # Decorative card image, clipped visually by placement.
    cards = ASSETS / "route25-cards.png"
    if cards.exists():
        c.saveState()
        c.translate(PAGE_W - 112, PAGE_H - 156)
        c.rotate(-8)
        c.drawImage(str(cards), 0, -42, 118, 162, preserveAspectRatio=True, mask="auto")
        c.restoreState()

    # Intro statement.
    c.setFillColor(colors.white)
    c.setStrokeColor(hex_color("#E4E8F7"))
    c.roundRect(42, 578, PAGE_W - 84, 54, 16, fill=1, stroke=1)
    draw_wrapped(
        c,
        "<b>What it is:</b> Elite Trainers are active Route 25 community members who post pulls, make trades, engage with other Trainers, and help the app grow through authentic sharing.",
        62,
        589,
        PAGE_W - 124,
        32,
        size=10.2,
        leading=13.2,
        color=INK,
    )

    bubble(
        c,
        42,
        414,
        246,
        136,
        fill=hex_color("#EEF2FF"),
        stroke=PURPLE,
        label="MONTHLY RHYTHM",
        title="Show up in the community",
        body="Each month, post at least <b>3 times</b>, and ensure at least <b>1 trade listing is active</b>. Then, engage naturally inside the Route 25 community.",
        tail="left",
    )
    bubble(
        c,
        322,
        414,
        248,
        136,
        fill=hex_color("#EAF9FF"),
        stroke=CYAN,
        label="SOCIAL SHARING",
        title="Share Route 25 your way",
        body="Share Route 25 at least <b>once per month</b> on Instagram Stories, TikTok, YouTube Shorts, or another social platform. Keep a Route 25 mention in bio.",
        tail="right",
    )

    c.setFillColor(hex_color("#FFF7DB"))
    c.setStrokeColor(YELLOW)
    c.roundRect(173, 348, 266, 44, 16, fill=1, stroke=1)
    draw_wrapped(
        c,
        "<b>No scripts. No stiff requirements.</b> Authenticity matters more than polish.",
        192,
        357,
        228,
        27,
        size=10,
        leading=12,
        color=hex_color("#4A3410"),
        align="CENTER",
    )

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(42, 318, "What Elite Trainers receive")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.8)
    c.drawString(42, 301, "Perks designed to reward participation, feedback, and community growth.")

    # Perks panel.
    c.setFillColor(colors.white)
    c.setStrokeColor(hex_color("#E4E8F7"))
    c.roundRect(42, 112, 330, 178, 18, fill=1, stroke=1)
    check_item(c, 61, 263, "Elite Trainer status in app: profile status, badge, and ETP section", PURPLE)
    check_item(c, 61, 229, "Free access to Route 25 Trainer Plus, awarded annually", CYAN)
    check_item(c, 61, 195, "Optional early access to new features through TestFlight", MINT)
    check_item(c, 61, 161, "Inclusion in the Elite Trainer section with a link to one social platform", PINK)
    check_item(c, 61, 127, "A direct line for feedback to help shape what comes next", YELLOW)

    c.setFillColor(hex_color("#101827"))
    c.roundRect(395, 112, 175, 178, 18, fill=1, stroke=0)
    c.setFillColor(hex_color("#1F2A44"))
    c.circle(550, 130, 70, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(414, 257, "Referral rewards")
    c.setFillColor(hex_color("#DCE7FF"))
    draw_wrapped(
        c,
        "Share your unique referral link for discounted Trainer Plus.",
        414,
        211,
        135,
        34,
        size=9.5,
        leading=12,
        color=hex_color("#DCE7FF"),
    )
    c.setFillColor(YELLOW)
    c.setFont("Helvetica-Bold", 36)
    c.drawString(414, 163, "$50")
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(414, 144, "for every 50 verified users")
    c.setFillColor(hex_color("#DCE7FF"))
    c.setFont("Helvetica", 8.8)
    c.drawString(414, 128, "using your referral link")

    trainer = ASSETS / "elite-trainer.png"
    if trainer.exists():
        c.drawImage(str(trainer), PAGE_W - 153, 272, 90, 160, preserveAspectRatio=True, mask="auto")

    draw_footer(c)
    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
