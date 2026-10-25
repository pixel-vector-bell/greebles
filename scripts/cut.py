import os, sys, concurrent.futures as cf
from PIL import Image, ImageFilter
from rembg import remove, new_session
sess = new_session('u2net')
SRC, OUT = 'set', 'cut'
def one(f):
    k = f[:-4]
    try:
        im = Image.open(f'{SRC}/{f}').convert('RGBA')
        cut = remove(im, session=sess)
        bb = cut.getbbox()
        if not bb: return (k, 'empty')
        cut = cut.crop(bb)
        # square canvas with margin, creature centred, feet near bottom
        w, h = cut.size; side = int(max(w, h) * 1.12)
        can = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        can.paste(cut, ((side - w) // 2, (side - h) // 2 + int(side * 0.03)), cut)
        # thick white sticker outline from the alpha mask
        a = can.split()[3]
        grow = a.filter(ImageFilter.MaxFilter(int(side * 0.035) | 1))
        outline = Image.new('RGBA', can.size, (255, 255, 255, 255)); outline.putalpha(grow)
        stick = Image.alpha_composite(outline, can)
        stick.resize((256, 256), Image.LANCZOS).save(f'{OUT}/{k}.webp', 'WEBP', quality=85)
        return (k, 'ok')
    except Exception as e:
        return (k, f'ERR {e}')
files = [f for f in os.listdir(SRC) if f.endswith('.png')]
if sys.argv[1:]: files = [f for f in files if f[:-4] in sys.argv[1:]]
for r in map(one, files): print(r)
