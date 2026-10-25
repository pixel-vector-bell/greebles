"""Generate all Greebles art (flat vector sticker style) via Bedrock Stable Image Ultra.
Writes /Users/pixelvector/.hermes/generated_images/greebles/set/<id>.png (1024 master) and a 256px webp final.
"""
import boto3, json, base64, os, sys, concurrent.futures as cf
from PIL import Image
c = boto3.client('bedrock-runtime', region_name='us-west-2')
OUT = '/Users/pixelvector/.hermes/generated_images/greebles/set'
os.makedirs(OUT, exist_ok=True)
STYLE = ("bold flat vector sticker illustration, thick dark outline, cel shaded, bright saturated colors, cute mascot style, "
         "full body, centered, single character only, plain solid soft-grey background, small ground shadow")
SPECIES = ("a cute goblin-like alien creature called a Greeble: HUGE long pointed goblin ears sticking out sideways from the head (like a gremlin), no wings, big glossy eyes with white highlights, "
           "small nose, round belly, short stubby legs, three-toed clawed feet, a curled tail")
STAGE = {1: "small young baby, chubby and round", 2: "grown-up, a bit taller and confident", 3: "big, powerful and heroic, larger and more armored"}
D = {
 'ashpup': 'dusty lavender-grey fur with soot smudges, sleepy smile', 'gleck': 'lavender-grey fur, soot smudges, holding a small pickaxe',
 'gleckor': 'big chubby purple-grey Greeble with stone shoulder pads and a big pickaxe, happy',
 'vorr': 'mossy green fur with little leaves sprouting from the head', 'vorrak': 'mossy green with a leafy mane, digging claws',
 'vorrakan': 'big brown-and-green Greeble wearing wooden tree-bark armor plates and a leafy crown',
 'klyx': 'translucent teal glass-crystal skin with facets', 'klyxar': 'shining golden-yellow prism crystal body glowing like the sun',
 'klyxen': 'deep indigo dusk-glass crystal body with tiny stars inside',
 'umberith': 'earthy brown umber skin with square stone patterns', 'umberox': 'big brown boulder-like body, rocky fists',
 'zoln': 'warm orange Greeble with glowing ember freckles, cheerful', 'zolnath': 'bright red Greeble with dark lava-rock patches on its skin and glowing orange cracks, happy',
 'phaest': 'golden-tan skin, wearing a miner helmet with a lamp, rare and proud', 'phaestyn': 'tall golden titan digger with drill arms',
 'quorvex': 'legendary golden armored digger king with a glowing star crown, majestic aura',
 'tidling': 'tiny light-blue water baby with a bubble on its head', 'nulith': 'sea-blue skin with a crescent-moon mark, fin-like ears, holding a little fishing net',
 'nulithar': 'big friendly navy-blue Greeble with glowing crescent moon marks, holding a trident',
 'iskari': 'pale sky-blue, wispy, floating on a little cloud', 'iskaran': 'sky-blue Greeble with a fluffy cloud-like mane, standing',
 'vesperid': 'soft violet Greeble wearing a little lilac veil cape', 'vesperax': 'dark purple with a starry night cape, glowing eyes',
 'thalune': 'murky teal-green with wavy water patterns', 'thalorn': 'big dark teal sea-serpent-like Greeble with fins and tentacle tail',
 'orryx': 'sea-green with a little harpoon and goggles', 'orryxan': 'teal harpooner with a big harpoon and captain hat',
 'caelith': 'pale silver-blue with feathery ears, elegant', 'caelithar': 'chubby white and sky-blue Greeble with feather tufts on its ears, standing',
 'aelurion': 'legendary white and aqua Greeble with a golden halo above its head and wavy fin-like ear tips, standing proudly',
 'scrappling': 'tiny rusty-red baby with a bolt stuck on its head', 'draug': 'rusty red skin with scrap metal plates bolted on, holding a wrench, friendly grin',
 'draugoth': 'big chubby crimson Greeble wearing a scrap-metal helmet and chest plate, giant wrench, happy grin',
 'velm': 'copper-orange rusty skin with rivets', 'velmor': 'muscular copper brawler with boxing-glove fists',
 'skarnox': 'olive green with thorny spikes on its back', 'skarnex': 'dark green covered in bramble vines and thorns',
 'hokari': 'slate-grey hollow-eyed shadowy Greeble wearing a little hood', 'hokarion': 'slate-grey and violet Greeble wearing a dark hooded cloak, friendly violet eyes',
 'pyrrax': 'bright red-orange with flame-tipped ears', 'pyrraxis': 'bright red-orange Greeble with a flickering flame mane on its head and glowing orange fists, full body standing',
 'nyxil': 'deep purple with a mask, ninja-like', 'nyxilar': 'void-black and purple with swirling cosmic patterns and a scarf',
 'myrrhax': 'legendary golden-and-crimson Greeble king with a crown and royal cape, majestic aura',
 'shellit': 'sandy-tan with a small spiral seashell on its back', 'shellor': 'big tan Greeble with a large armored shell back',
 'coralin': 'pink coral-branch ears and polka dots', 'coraleth': 'bright magenta Greeble with coral branches growing from its ears and back',
 'boltik': 'yellow with a lightning-bolt tail, sparks', 'boltrax': 'electric orange-yellow with crackling sparks', 'boltaros': 'big friendly yellow-and-navy Greeble with a lightning-bolt shaped tail and tiny sparks, big smile',
 'cogling': 'grey metal skin with a gear on its belly', 'cogmaw': 'big grey Greeble with gear shoulders and a cog jaw',
 'shardy': 'icy light-blue crystal shards on its back', 'shardon': 'crystal Greeble covered in blue crystal shards',
 'shardros': 'big deep-blue Greeble with tall crystal spikes growing from its back and shoulders, full body standing',
 'lumen': 'glowing pale-yellow light Greeble with a lantern tail', 'lumenar': 'radiant golden glowing Greeble with sun rays',
 'aurelith': 'legendary Greeble wearing an ice-blue crystal crown and crystal armor, majestic, alone',
 'starborn': 'mythic cosmic pink-and-white Greeble made of stars and nebula, glowing, magical',
 'riftling': 'small plum-purple Greeble with a little violet spiral mark on its belly, on a white background',
 'riftor': 'purple Greeble with a violet spiral mark on its forehead and darker purple stripes, whole body standing on a white background',
 'riftmaw': 'big chunky friendly indigo-purple Greeble with a happy grin, wearing a silver chest plate, flexing its strong arms, whole body standing on a white background',
 'glimmet': 'lavender Greeble with a small yellow star on its forehead, waving one hand, nothing in its hands, whole body standing on a white background',
 'glimmeron': 'periwinkle-blue Greeble wearing a short yellow cape, a little star on the tip of its tail, whole body standing on a white background',
 'echolet': 'teal Greeble with huge pointed ears decorated with light-teal ring stripes, whole body standing on a white background',
 'echoran': 'dark-teal Greeble wearing a crystal visor, ripple rings glowing on its ears and chest',
 'riftking': 'legendary lilac Greeble wearing a purple crystal crown and a short royal purple cape, majestic, alone, whole body standing on a white background',
 'tidecrown': 'mythic turquoise Greeble wearing a big golden crown decorated with pink coral and pearls, holding a golden trident, sparkles, whole body standing on a white background',
 'gearheart': 'mythic amber-orange Greeble with small round ears, wearing brass goggles on its head and a brass backpack with a golden gear, holding a wrench, golden sparkles, whole body standing on a white background',
 'verdance': 'mythic bright-green Greeble with pink and yellow flowers blooming on its head and shoulders, a leafy tail, golden sparkles around it, whole body standing on a white background',
 'riftborn': 'mythic magenta-and-violet Greeble with white star-shaped spots all over its skin, a small golden crown of stars, sharp clean outline, whole body standing on a white background',
}
BOSSES = {
 'boss_ash': 'a big menacing rusty robot warden guardian, rust-orange metal, one glowing eye, cartoon',
 'boss_tide': 'a huge underwater dredger robot with scoop claws, blue metal, cartoon',
 'boss_rust': 'a giant scrap-metal colossus robot made of junk, storm-yellow lights, cartoon',
 'boss_glass': 'a tall crystal sentinel robot made of glowing glass prisms, cartoon',
 'boss_void': 'a huge purple-and-silver engine robot with a glowing violet orb in its chest, spiky antenna, big metal fists, cartoon, on a white background',
 'robot_drone': 'a small round flying rust-orange robot drone with one big eye and little propellers, cartoon',
 'robot_pylon': 'a small cute yellow robot shaped like a lighthouse tower on three legs, one big round blue eye, a lightning bolt on top, cartoon, whole robot visible, on a white background',
 'robot_colossus': 'a chunky red-orange patrol robot on stubby legs with big fists and a hot glowing grille, cartoon',
}
N = ("text, letters, words, watermark, logo, signature, multiple creatures, two characters, crowd, extra limbs, extra heads, duplicate, human, "
     "realistic photo, scary, horror, menacing, creepy, gore, blurry, cropped, sticker border, white outline border, frame, scenery, landscape, dark background, night sky, humanoid, human body, second creature, fish, wings, bat wings, dragon, flying, charmander, pokemon")

def gen(item):
    key, prompt, seed = item
    final = f'{OUT}/{key}.webp'
    if os.path.exists(final) and os.path.getsize(final) > 2000: return (key, 'skip')
    for attempt in range(3):
        try:
            out = json.loads(c.invoke_model(modelId='stability.stable-image-ultra-v1:1', body=json.dumps(
                {"prompt": prompt, "negative_prompt": N, "mode": "text-to-image", "aspect_ratio": "1:1", "output_format": "png", "seed": seed + attempt}))['body'].read())
            if 'images' not in out: continue
            master = f'{OUT}/{key}.png'
            open(master, 'wb').write(base64.b64decode(out['images'][0]))
            Image.open(master).convert('RGB').resize((256, 256), Image.LANCZOS).save(final, 'WEBP', quality=82)
            assert os.path.getsize(final) > 2000
            return (key, 'ok')
        except Exception as e:
            err = str(e)
    return (key, 'FAIL')

if __name__ == '__main__' and not os.environ.get('NOGEN'):
    kinds = json.load(open('/tmp/greeb/kinds.json'))
    jobs = []
    for k in kinds:
        d = D[k['id']]
        jobs.append((k['id'], f"{SPECIES}, {STAGE[k['stage']]}, {d}. {STYLE}, cute and friendly, not scary, no scenery", int(os.environ.get('SEED', 4242))))
    for b, d in BOSSES.items():
        jobs.append((b, f"{d}, full body, centered, single robot only, bold flat vector sticker illustration, thick dark outline, cel shaded, plain solid soft-grey background, whole robot visible with margin", int(os.environ.get('SEED', 4242))))
    only = sys.argv[1:]
    if only: jobs = [j for j in jobs if j[0] in only]
    with cf.ThreadPoolExecutor(6) as ex:
        res = list(ex.map(gen, jobs))
    print(res)
    print('fails:', [r for r in res if r[1] == 'FAIL'])



