"""Greebles 0.11 redraw: everything except the 11 kinds that already read as goblins.
Description FIRST (Ultra drops the tail of long prompts), short shared goblin template after.
Two seeds per kind -> v11/s<seed>/<id>.png ; pick later.
"""
import boto3, json, base64, os, sys, concurrent.futures as cf
c = boto3.client('bedrock-runtime', region_name='us-west-2')
BASE = os.path.expanduser('~/.hermes/generated_images/greebles/v11')
T = ("goblin creature with two big leaf-shaped pointed ears, flat round face with no snout, big round glossy eyes, tiny nose, cream belly, chubby round body, "
     "short arms and legs, no tail, no wings. Cute 2D flat vector sticker, thick black outline, cel shaded, full body standing, centered, plain white background")
N = ("wings, bat wings, feathered wings, dragon, lizard, salamander, dinosaur, scales, snout, muzzle, long tail, lizard tail, curled tail, horns, spikes along the back, "
     "pokemon, pikachu, charmander, red cheeks, flying, scenery, landscape, dark background, night sky, stars background, space, text, letters, watermark, "
     "multiple creatures, two characters, human, scary, creepy, blurry, cropped, frame, border, 3d render, photorealistic, pixel art")
D = {
 'ashpup': 'tiny baby lavender-grey goblin with sooty smudges on its cheeks and a little miner headlamp strap',
 'gleck': 'lavender-grey goblin with a dusty red bandana around its neck, holding a small pickaxe',
 'vorrak': 'moss-green goblin with a round bushy leaf mane like a hedge around its head, holding a small shovel',
 'klyx': 'teal goblin with one small glass crystal growing on top of its head and see-through glassy ear tips',
 'klyxar': 'golden-yellow goblin wearing a glowing prism crystal pendant on its chest, cheerful',
 'klyxen': 'very dark indigo goblin with three jagged black glass shards sticking up from its back, calm',
 'umberith': 'brown goblin with square stone-block patterns on its skin, hugging a small round rock',
 'umberox': 'big boxy dark-brown goblin with huge rocky boulder fists and a stone shoulder pad',
 'zoln': 'warm orange goblin with glowing ember freckles, holding a small lantern full of hot coals',
 'zolnath': 'red goblin with black lava-rock plates on its shoulders and glowing orange cracks, holding a hot hammer',
 'phaestyn': 'tall golden-tan goblin wearing a yellow hard hat, with big metal drill-bit gauntlets on both arms',
 'quorvex': 'legendary golden armored goblin king wearing a star crown and holding a golden pickaxe sceptre, proud',
 'tidling': 'tiny baby light-blue goblin with a soap bubble floating on its head, splashing',
 'nulith': 'sea-blue goblin with fin-shaped ears and a white crescent moon mark, holding a little fishing net',
 'nulithar': 'big navy-blue goblin in a yellow fisherman raincoat, holding a trident',
 'iskari': 'pale sky-blue goblin sitting on a small fluffy white cloud',
 'iskaran': 'sky-blue goblin holding a big green leaf over its head like a glider',
 'vesperax': 'dark purple goblin in a tall pointed hood with a torn hem, its hands glowing soft violet',
 'thalune': 'murky teal-green goblin with wavy water stripes, holding a fishing rod',
 'thalorn': 'big hunched navy goblin with a cream belly, barnacles on its shoulders, carrying a small anchor',
 'orryx': 'sea-green goblin wearing round diving goggles, holding a small harpoon',
 'orryxan': 'teal goblin wearing a sea captain hat and a striped shirt, holding a big harpoon',
 'caelith': 'pale silver-blue goblin with long upright ears and a light blue scarf, elegant',
 'caelithar': 'white and sky-blue goblin with blue markings, wearing pilot goggles and a long flowing scarf',
 'aelurion': 'legendary white and aqua goblin with a golden halo above its head, wearing a flowing aqua robe',
 'scrappling': 'tiny rusty-brown goblin with a square head, a bolt stuck on top and one glowing green eye-lens',
 'draugoth': 'big boxy goblin wearing red-and-black scrap metal plate armor and a bucket helmet, holding a metal pipe',
 'velm': 'copper-orange goblin with rivets on its skin and a bandage on its arm, ready to box',
 'velmor': 'muscular copper-orange goblin wearing big red boxing gloves',
 'skarnox': 'black-green goblin with a row of thorny brambles on its head, grumpy',
 'hokari': 'small slate-grey goblin wearing a ragged grey sack hood with two eye holes',
 'pyrrax': 'red-orange goblin with little flames on the tips of its ears, holding a match',
 'pyrraxis': 'red-and-black goblin with a tall flame mohawk on its head and glowing orange fists',
 'nyxil': 'deep purple goblin wearing a black ninja mask and headband',
 'nyxilar': 'black and purple goblin with a long flowing purple scarf, holding two small daggers',
 'myrrhax': 'legendary grey-green goblin warlord wearing a bone circlet and a thick fur cape, holding a big axe',
 'shellit': 'sandy-tan goblin wearing a small spiral seashell on its back like a backpack',
 'shellor': 'big tan goblin wearing a huge round turtle shell as armor on its back',
 'coralin': 'pink goblin with polka dots and little coral branches on its ear tips',
 'coraleth': 'magenta goblin wearing a coral crown and a green seaweed skirt',
 'boltik': 'yellow goblin with zigzag lightning-bolt shaped hair, tiny sparks',
 'boltrax': 'orange goblin with a copper antenna on its head, crackling with sparks',
 'boltaros': 'big stocky goblin with yellow and black stripes, fluffy electric ear tufts, holding a lightning staff',
 'cogling': 'grey metal-skinned goblin with a big gear printed on its belly, holding a screwdriver',
 'cogmaw': 'copper goblin with a huge jaw full of gear-shaped teeth, grinning',
 'shardy': 'icy light-blue goblin with three small crystal shards on top of its head',
 'shardon': 'blue goblin wearing chunky crystal shoulder pads',
 'shardros': 'big deep-blue goblin with two tall crystal pillars rising from its shoulders',
 'lumen': 'pale yellow goblin holding a glowing paper lantern',
 'lumenar': 'dark navy goblin with a glowing golden belly and golden ear rings',
 'aurelith': 'legendary ice-blue goblin queen wearing a crystal crown and crystal armor, majestic',
 'riftling': 'small lavender-pink goblin with ears bigger than its head',
 'riftor': 'purple goblin with a violet spiral mark on its forehead and darker purple stripes',
 'glimmet': 'deep indigo goblin with small white star-shaped spots, holding a little star scepter',
 'glimmeron': 'periwinkle-blue goblin wearing a short yellow cape with a star clasp',
 'echolet': 'cyan and white goblin with huge round satellite-dish shaped ears',
 'echoran': 'dark-teal goblin wearing a crystal visor, ripple ring markings on its ears and chest',
 'riftking': 'legendary lilac goblin wearing a purple crystal crown and a short royal purple cape',
 'starborn': 'mythic pink and white goblin wearing a cloak with star patterns, holding a star wand',
 'tidecrown': 'mythic turquoise goblin wearing a golden crown with pink coral and pearls, holding a golden trident',
 'riftborn': 'mythic magenta and violet goblin with white star-shaped spots and a small golden crown',
}
# 0.11 round 2: stricter ears for the stubborn ones
T2 = ("goblin creature with two pointed elf-like goblin ears made of solid skin, flat round face with no snout, big round eyes, tiny nose, wide friendly grin, cream belly, "
      "chubby round body, short arms and legs, no tail, no wings. Cute 2D flat vector sticker, thick black outline, cel shaded, full body standing, centered, plain white background")
N2 = N + ", spiral, swirl, spiral belly, bubble, translucent, transparent, slime, bat ears, membrane ears, veined ears, ear membranes, fins, fin ears, frills, pikachu ears, yellow mouse, turtle, ghost"
D2 = {
 'tidling': 'tiny baby blue goblin wearing a bright yellow raincoat and yellow rain boots, holding a little toy bucket',
 'iskari': 'pale white and mint goblin holding the string of a red paper kite, wearing a light teal scarf blowing in the wind',
 'ashpup': 'tiny baby lavender goblin toddler wearing a big yellow hard hat too large for its head, holding a little candle',
 'gleck': 'tall lean dusky purple-grey goblin miner with a red bandana tied on its head, a pickaxe over its shoulder and a sack of rocks',
 'riftling': 'small lavender goblin kid wearing an oversized purple hoodie, hands in the hoodie pocket, cheeky grin',
 'riftling': 'small lavender goblin kid with a messy purple tuft of hair and a torn violet scarf, mischievous grin',
 'caelithar': 'white and sky-blue goblin with plain pointed ears, wearing aviator goggles, a brown leather flight jacket and a long blue scarf',
 'verdance': 'bright-green goblin with a crown of pink and yellow flowers on its head and a leafy green poncho, holding a flowering staff',
 'iskari': 'pale sky-blue goblin wearing a fluffy white cloud-shaped hat, standing on its own two feet',
 'zolnath': 'red goblin blacksmith with a leather apron, black lava-rock gauntlets, holding a glowing hammer, no horns, plain pointed ears',
 'cogmaw': 'big copper goblin mechanic with a metal jaw guard and a big gear on its belt, holding a large wrench, no horns',
 'echolet': 'cyan and white goblin wearing big round headphones over its pointed ears',
 'klyxen': 'dark indigo goblin wearing a black glass visor and a dusk-purple scarf, holding a glass shard',
 'shardros': 'big deep-blue goblin miner wearing a crystal-studded helmet and carrying a big crystal on its back',
 'riftor': 'purple goblin wearing a violet hooded jacket with a spiral patch on the chest, grinning',
 'thalorn': 'big hunched navy goblin with barnacles on its shoulders and a seaweed beard, carrying a small anchor',
 'coralin': 'pink goblin with polka dots, little pink coral branches sticking up from the tips of its ears, holding a seashell',
 'riftking': 'lilac goblin king wearing a tall purple crystal crown and a long royal purple robe with gold trim, holding a sceptre',
 'riftmaw': 'big chunky indigo goblin with a silver chest plate and spiked shoulder pads, flexing, toothy grin',
 'aelurion': 'white and aqua goblin with a golden halo above its head, wearing a flowing aqua robe',
 'pyrraxis': 'red goblin with a flaming orange mohawk hairstyle, glowing orange fists, wearing a black vest',
 'shardy': 'icy light-blue goblin wearing a small crystal helmet with three shards on top',
 'klyx': 'teal goblin wearing a glass crystal on a headband, holding a small chisel',
 'ashpup': 'tiny baby lavender-grey goblin with sooty cheeks, wearing a miner headlamp',
 'zoln': 'warm orange goblin with glowing ember freckles and a brown leather apron, holding a small lantern',
 'zolnath': 'big red goblin blacksmith with black lava-rock shoulder plates and a hot glowing hammer, no horns',
 'nulith': 'sea-blue goblin wearing a little fisherman bucket hat, holding a small fishing net',
 'riftling': 'small lavender-pink goblin with a violet spiral mark on its belly, waving',
 'riftborn': 'magenta goblin with white star-shaped spots on its skin, wearing a small golden crown and a violet cloak',
 'nyxil': 'deep purple goblin wearing a black ninja mask and a red headband',
 'klyxar': 'golden-yellow goblin with a pointed nose wearing a prism crystal pendant, cheerful',
 'boltik': 'small teal-and-yellow goblin with zigzag hair, wearing rubber boots, sparks in its hands',
 'boltrax': 'orange goblin with a copper antenna on its head and a tool belt, crackling with sparks',
 'boltaros': 'big stocky dark-navy goblin with yellow lightning stripes and a thunder staff',
 'lumen': 'pale-green goblin holding a glowing paper lantern on a stick',
 'shellor': 'big tan goblin carrying a huge spiral seashell on its back like a backpack',
 'velmor': 'muscular rust-brown goblin wearing big red boxing gloves and a headband',
 'pyrrax': 'red-orange goblin with a little candle flame on top of its head, holding a match',
}
def run(job):
    k, seed = job
    out_dir = f'{BASE}/s{seed}'; os.makedirs(out_dir, exist_ok=True)
    p = f'{out_dir}/{k}.png'
    if os.path.exists(p) and os.path.getsize(p) > 5000: return (k, seed, 'skip')
    for a in range(3):
        try:
            r2 = os.environ.get('ROUND2') == '1'
            out = json.loads(c.invoke_model(modelId='stability.stable-image-ultra-v1:1', body=json.dumps({
                'prompt': f'A Greeble: {D2[k]}. {T2}' if r2 else f'A Greeble: {D[k]}. {T}', 'negative_prompt': N2 if r2 else N, 'mode': 'text-to-image',
                'aspect_ratio': '1:1', 'output_format': 'png', 'seed': seed + a}))['body'].read())
            if 'images' not in out: print(k, out.get('finish_reasons')); continue
            open(p, 'wb').write(base64.b64decode(out['images'][0]))
            return (k, seed, 'ok')
        except Exception as e: print(k, seed, str(e)[:120])
    return (k, seed, 'FAIL')
if __name__ == '__main__':
    ks = sys.argv[1:] or (list(D2) if os.environ.get('ROUND2') == '1' else list(D))
    seeds = [int(x) for x in os.environ.get('SEEDS', '1101,1202').split(',')]
    jobs = [(k, s) for k in ks for s in seeds]
    with cf.ThreadPoolExecutor(6) as ex: res = list(ex.map(run, jobs))
    print('done', len(res), 'fails', [r for r in res if r[2] == 'FAIL'])
