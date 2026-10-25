import boto3, json, base64, os, sys, concurrent.futures as cf
from PIL import Image
os.environ['NOGEN'] = '1'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genset import D, STAGE, BOSSES
c = boto3.client('bedrock-runtime', region_name='us-west-2')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.environ.get('OUTDIR', 'v3')); os.makedirs(OUT, exist_ok=True)
TEMPLATE = ("Cute chibi goblin creature, front-facing symmetrical standing pose, full body, very large smooth dome-shaped head wider than its small pear-shaped body, "
  "two big triangular pointed ears sticking diagonally up and out like a gremlin, huge widely spaced oval glossy eyes with thick black outline and white sparkle highlights, "
  "tiny nose and small gentle smile, pale cream oval belly patch, short arms at its sides, short squat legs with three-clawed feet, thin curly tail, no wings, "
  "2D flat vector sticker illustration, thick bold black outline, flat colors, simple cel shading, isolated on a plain pure white background, small grey oval ground shadow, no environment")
N = ("wings, bat wings, dragon, scales, scenery, landscape, dark background, night sky, text, letters, watermark, signature, multiple creatures, "
     "two characters, human, humanoid, scary, menacing, creepy, horror, blurry, cropped, frame, border, pikachu, pokemon, 3d render, cgi, photorealistic, depth of field, bokeh, room, floor, forest, cave, workshop")
def run(item):
    key, prompt = item
    fin = f'{OUT}/{key}.webp'
    if os.path.exists(fin) and os.path.getsize(fin) > 2000: return (key, 'skip')
    for a in range(3):
        try:
            out = json.loads(c.invoke_model(modelId='stability.stable-image-ultra-v1:1', body=json.dumps({
                "prompt": prompt, "negative_prompt": N, "mode": "text-to-image", "aspect_ratio": "1:1", "output_format": "png", "seed": int(os.environ.get('SEED', 31)) + a}))['body'].read())
            if 'images' not in out: continue
            open(f'{OUT}/{key}.png', 'wb').write(base64.b64decode(out['images'][0]))
            Image.open(f'{OUT}/{key}.png').convert('RGB').resize((256, 256), Image.LANCZOS).save(fin, 'WEBP', quality=82)
            return (key, 'ok')
        except Exception as e: pass
    return (key, 'FAIL')
if __name__ == '__main__':
    kinds = json.load(open('/tmp/greeb/kinds.json'))
    STY = "cute cartoon mascot character, full body head to toe, standing, centered with empty space around it, isolated on a plain pure white background, no scenery, thick black outline, cel shaded"
    SHORT = ("chibi goblin with a big round head, huge pointed ears sticking up and out, big glossy eyes, cream belly, short legs, curly tail, no wings. "
             "Cartoon mascot, full body, thick black outline, cel shaded, plain white background, no scenery")
    jobs = [(k['id'], f"A Greeble: {D[k['id']]}, {STAGE[k['stage']]}. {SHORT}") for k in kinds]
    jobs += [(b, f"{d}, full body, centered, single robot only, whole robot visible with margin, bold flat vector sticker illustration, thick black outline, cel shaded, plain white background") for b, d in BOSSES.items()]
    only = sys.argv[1:]
    if only: jobs = [j for j in jobs if j[0] in only]
    with cf.ThreadPoolExecutor(6) as ex: res = list(ex.map(run, jobs))
    print(res); print('fails', [r for r in res if r[1] == 'FAIL'])
