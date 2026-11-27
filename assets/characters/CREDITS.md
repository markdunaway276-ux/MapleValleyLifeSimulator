# Character credits

All files in this folder were made from two free packs by **Quaternius** (https://quaternius.com).
**License:** Creative Commons Zero (CC0 1.0), https://creativecommons.org/publicdomain/zero/1.0/
Free for personal, educational and commercial use. Credit is appreciated but not required.

| File | From | Changes |
| --- | --- | --- |
| `male.glb`, `female.glb` | Universal Base Characters [Standard]: `Superhero_Male_FullBody`, `Superhero_Female_FullBody` | Normal and roughness maps removed, colour textures resized to 512 px WebP. Clothes are painted on in the game's shader (`src/world/characterModel.js`). |
| `hair-*.glb` | Universal Base Characters [Standard]: `Hairstyles/Origin at 0` | Normal maps removed, textures resized to 256 px WebP. |
| `anims-extra.glb` | Universal Animation Library 2 [Standard]: `UAL2_Standard.glb` | Only `Idle_FoldArms_Loop` and `Idle_TalkingPhone_Loop` kept, same trimming as `anims.glb`. |
| `anims.glb` | Universal Animation Library [Standard]: `UAL1_Standard.glb` | Only `Idle_Loop`, `Walk_Loop`, `Idle_Talking_Loop` and `Interact` kept; mannequin mesh and scale tracks removed; keys resampled. |

To add more clips, rebuild `anims.glb` from `UAL1_Standard.glb` and add the name to `CLIPS` in `characterModel.js`.

## Standing animation

`mixamo-breathing-idle.json` is Mixamo's **Breathing Idle** (https://www.mixamo.com, Adobe), baked to per-bone rotations with the mixamo-handoff `mixamo_bake.py` tool and retargeted onto the Quaternius skeleton at load (`src/world/mixamoRetarget.js`). Mixamo animations are free to use in games under Adobe's Mixamo terms; they should not be redistributed as stand-alone animation files outside the game.

## Action clips (`actions/*.json`)

Third-person player actions, each a Mixamo animation (https://www.mixamo.com, Adobe) baked with the same `mixamo_bake.py` tool, trimmed, reduced to 15 fps and made in-place (hip drift removed, height kept). Same Mixamo terms as above: used inside the game, not for redistribution as stand-alone animation files.

| File | Mixamo animation | Used for |
| --- | --- | --- |
| door.json | Opening Door Inwards (0.3–2.9 s) | opening / closing doors |
| press.json | Button Pushing | buttons, vending machines, knocking |
| reach.json | Picking Up Object | grabbing from shelves, handing laundry back |
| pickup.json | Picking Up (0.3–6.0 s) | picking up bags, taking laundry out |
| load.json | Gathering Objects (0.4–5.6 s) | loading washers and dryers |
| fold.json | Rummaging | folding laundry |
| restock.json | Searching Files High | restocking the Market |
| typing.json | Looking Through Files Low | desk work |
| eat.json | Drinking (2.0–5.8 s) | eating |
| carry.json | Carrying | holding a laundry basket (arms also layered over the walk) |
| walk.json | Walking (in place) | walking, for the player's own character (surviver.glb) |


