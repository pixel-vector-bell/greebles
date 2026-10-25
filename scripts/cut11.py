"""Cut v11/s<seed>/*.png into sticker webps (v11/cut_s<seed>/<id>.webp), same recipe as cut.py."""
import os, sys
from PIL import Image, ImageFilter
from rembg import remove, new_session
sess = new_session('u2net')
BASE = os.path.expanduser('~/.hermes/generated_images/greebles/v11')
def one(src, dst):
    im = Image.open(src).convert('RGBA')
    cut = remove(im, session=sess)
    bb = cut.getbbox()
    if not bb: return 'empty'
    cut = cut.crop(bb)
    w, h = cut.size; side = int(max(w, h) * 1.12)
    can = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    can.paste(cut, ((side - w) // 2, (side - h) // 2 + int(side * 0.03)), cut)
    a = can.split()[3]
    grow = a.filter(ImageFilter.MaxFilter(int(side * 0.035) | 1))
    outline = Image.new('RGBA', can.size, (255, 255, 255, 255)); outline.putalpha(grow)
    Image.alpha_composite(outline, can).resize((256, 256), Image.LANCZOS).save(dst, 'WEBP', quality=85)
    # corner check of the raw render: plain white bg expected
    px = Image.open(src).convert('RGB').resize((64, 64))
    corners = [px.getpixel(p) for p in [(1, 1), (62, 1), (1, 62), (62, 62)]]
    return 'ok' if min(min(c) for c in corners) > 200 else 'nonwhite-bg'
for sd in sorted(os.listdir(BASE)):
    if not sd.startswith('s'): continue
    out = f'{BASE}/cut_{sd}'; os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(f'{BASE}/{sd}')):
        if not f.endswith('.png'): continue
        dst = f'{out}/{f[:-4]}.webp'
        if os.path.exists(dst): continue
        r = one(f'{BASE}/{sd}/{f}', dst)
        if r != 'ok': print(sd, f[:-4], r)
print('cut done')
