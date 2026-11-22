# Generates PWA icons from the Wiki's Slayer skill icon (run: python scripts/icons.py)
import io, urllib.request
from PIL import Image, ImageDraw

req = urllib.request.Request('https://oldschool.runescape.wiki/images/Slayer_icon_(detail).png', headers={'User-Agent': 'osrs-slayer-helper'})
SLAYER = Image.open(io.BytesIO(urllib.request.urlopen(req).read())).convert('RGBA')  # 46x46 pixel art

def icon(size, pad, scale):
    im = Image.new('RGBA', (size, size), (18, 17, 16, 255))
    d = ImageDraw.Draw(im)
    p = int(size * pad)
    d.rounded_rectangle([p, p, size - p, size - p], radius=int(size * 0.18), fill=(31, 29, 26, 255), outline=(201, 168, 90, 255), width=max(2, size // 64))
    art = SLAYER.resize((SLAYER.width * scale, SLAYER.height * scale), Image.NEAREST)  # integer scale keeps pixels crisp
    im.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return im

icon(192, 0.06, 3).save('public/icons/icon-192.png')
icon(512, 0.06, 8).save('public/icons/icon-512.png')
icon(512, 0.14, 6).save('public/icons/maskable-512.png')  # stays inside the maskable safe zone
print('icons ok')
