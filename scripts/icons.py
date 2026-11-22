# Generates PWA icons (run: python scripts/icons.py)
from PIL import Image, ImageDraw
def icon(size, pad):
    im = Image.new('RGBA', (size, size), (18, 17, 16, 255))
    d = ImageDraw.Draw(im)
    s = size; p = int(s * pad)
    d.rounded_rectangle([p, p, s - p, s - p], radius=int(s * 0.18), fill=(31, 29, 26, 255), outline=(201, 168, 90, 255), width=max(2, s // 64))
    c = s / 2; w = s * 0.05
    gold = (201, 168, 90, 255)
    for sign in (1, -1):  # crossed swords
        d.line([(c - sign * s * 0.24, c + s * 0.24), (c + sign * s * 0.22, c - s * 0.22)], fill=gold, width=int(w))
        hx, hy = c - sign * s * 0.17, c + s * 0.17
        d.line([(hx - s * 0.06, hy - sign * sign * s * 0.06 * -1), (hx + s * 0.06, hy + s * 0.06 * -1)], fill=gold, width=int(w * 0.8))
    d.ellipse([c - s * 0.06, c - s * 0.06, c + s * 0.06, c + s * 0.06], fill=(208, 87, 77, 255))
    return im
icon(192, 0.06).save('public/icons/icon-192.png')
icon(512, 0.06).save('public/icons/icon-512.png')
icon(512, 0.14).save('public/icons/maskable-512.png')
print('icons ok')
