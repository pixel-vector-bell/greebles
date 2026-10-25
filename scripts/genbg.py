import boto3, json, base64, os, sys, concurrent.futures as cf
from PIL import Image
c = boto3.client('bedrock-runtime', region_name='us-west-2')
OUT = os.path.expanduser('~/.hermes/generated_images/greebles/bg'); os.makedirs(OUT, exist_ok=True)
STY = ("2D flat cartoon mobile game background, side view landscape, simple flat shapes, soft gradients, gentle pastel colors, low horizon line at one third height, "
       "wide empty flat ground filling the lower two thirds, uncluttered, calm, no characters, no creatures, no animals, no people, no robots, no machines, no text")
N = "creatures, characters, animals, people, robot, robots, machines, mech, text, letters, watermark, logo, signature, frame, border, canvas edge, photo, realistic, 3d render, dark, night, horror, busy, clutter, top-down view, lightning"
BG = {
  'ash': 'side view of a calm alien desert plain with soft lavender and grey ash dunes, small craters, a tiny crashed spaceship far away on the horizon, pale lilac sky with two pale moons',
  'tide': 'side view of a calm alien beach with a few shallow turquoise tide pools on flat pale sand, a few pink coral bits at the edges, gentle sea on the horizon, soft blue sky with puffy clouds',
  'rust': 'side view of a calm empty junkyard plain, flat orange dirt ground, small rusty scrap heaps and old pipes far away on the horizon only, warm orange sky with clouds, empty, deserted',
  'glass': 'side view of a calm crystal valley at dusk, flat pale blue crystal ground, a few tall teal crystal spires far away on the horizon, soft lavender-blue evening sky with a few stars',
  'void': 'side view of a calm flat purple alien plain, smooth lilac ground, a soft glowing violet crack far away in a pastel purple sky, a few small floating rocks on the horizon',
}
def run(k):
    fin = f'{OUT}/{k}.webp'
    if os.path.exists(fin): return (k, 'skip')
    for a in range(3):
        try:
            out = json.loads(c.invoke_model(modelId='stability.stable-image-ultra-v1:1', body=json.dumps({
                "prompt": f"{BG[k]}. {STY}", "negative_prompt": N, "mode": "text-to-image", "aspect_ratio": "4:5", "output_format": "png", "seed": 500 + a}))['body'].read())
            if 'images' not in out: continue
            open(f'{OUT}/{k}.png', 'wb').write(base64.b64decode(out['images'][0]))
            im = Image.open(f'{OUT}/{k}.png').convert('RGB'); im.thumbnail((640, 800), Image.LANCZOS)
            im.save(fin, 'WEBP', quality=72)
            return (k, 'ok')
        except Exception as e: err = str(e)[:100]
    return (k, 'FAIL')
if __name__ == '__main__':
    ks = sys.argv[1:] or list(BG)
    with cf.ThreadPoolExecutor(5) as ex: print(list(ex.map(run, ks)))
