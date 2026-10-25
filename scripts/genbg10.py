import boto3, json, base64, os, sys, concurrent.futures as cf
from PIL import Image
c = boto3.client('bedrock-runtime', region_name='us-west-2')
OUT = os.path.expanduser('~/.hermes/generated_images/greebles/bg10'); os.makedirs(OUT, exist_ok=True)
STY = ("2D flat cartoon mobile game background, side view landscape, simple flat shapes, soft gradients, gentle pastel colors, bright daylight, low horizon line at one third height, "
       "wide empty flat ground filling the lower two thirds, uncluttered, calm, no characters, no creatures, no animals, no people, no robots, no machines, no text")
N = "creatures, characters, animals, people, robot, robots, machines, mech, text, letters, watermark, logo, signature, frame, border, photo, realistic, 3d render, dark, night, black sky, space, stars, galaxy, nebula, horror, busy, clutter, top-down view, lightning"
BG = {
  'glass': 'side view of a bright calm crystal valley in daylight, flat smooth pale icy-blue ground, three tall soft teal and aqua crystal spires far away on the horizon, a few small crystal shards near the edges, pale sky-blue sky with soft white clouds',
  'void': 'side view of a calm strange pastel purple alien meadow in daylight, smooth lilac ground with a few curly violet plants at the edges, a few small floating purple rock islands in the sky, a soft pink and lavender sky with swirly pastel clouds, a thin glowing pink crack in the far sky',
}
SEEDS = [701, 702, 703]
def run(job):
    k, sd = job
    fin = f'{OUT}/{k}_{sd}.webp'
    if os.path.exists(fin): return (k, sd, 'skip')
    for a in range(2):
        try:
            out = json.loads(c.invoke_model(modelId='stability.stable-image-ultra-v1:1', body=json.dumps({
                "prompt": f"{BG[k]}. {STY}", "negative_prompt": N, "mode": "text-to-image", "aspect_ratio": "4:5", "output_format": "png", "seed": sd}))['body'].read())
            if 'images' not in out: continue
            p = f'{OUT}/{k}_{sd}.png'
            open(p, 'wb').write(base64.b64decode(out['images'][0]))
            im = Image.open(p).convert('RGB'); im.thumbnail((640, 800), Image.LANCZOS)
            im.save(fin, 'WEBP', quality=72)
            return (k, sd, 'ok')
        except Exception as e: print(k, sd, str(e)[:120])
    return (k, sd, 'FAIL')
if __name__ == '__main__':
    jobs = [(k, s) for k in BG for s in SEEDS]
    with cf.ThreadPoolExecutor(6) as ex: print(list(ex.map(run, jobs)))
