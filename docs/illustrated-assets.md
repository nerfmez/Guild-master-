# Illustrated UI artwork

These PNGs were authored with the built-in Imagegen tool, then resized for delivery. Runtime code only loads and places the illustrations. Each icon was generated in a separate request with a transparent background. Region artwork was generated in five separate requests.

Assets live in `assets/illustrated/`. UI icons are 192 × 192; region art is 640 × 360. The PNGs preserve alpha and use a 256-color palette to keep the download small. `scripts/export.mjs` embeds the exact files in standalone `play.html` so Android downloads and GitHub Pages do not need external image requests.

## Prompt set

Icon shared prompt: “Use case: stylized-concept. Asset type: single game UI icon for cozy Guild Master fantasy management game. Hand DRAWN ink and opaque gouache illustration, confident dark warm-brown outline, simplified silhouette legible at 32 pixels, warm cream/sage/coral palette, soft cel shadows. One centered isolated subject occupying 82% of square, generous clear margin on all sides. Transparent background. No frame, text, letters, watermark, ground, scenery, glow outside silhouette. Not pixel art, not 3D, not vector.”

| File | Subject appended to prompt |
| --- | --- |
| hammer.png | a carpenter's steel hammer with a walnut handle |
| scroll.png | a curled parchment quest scroll, crimson wax seal, tiny decorative ink lines without letters |
| people.png | two friendly young adult fantasy adventurers, busts, one brown-haired swordsman and one auburn-haired ranger |
| house.png | a charming timber cottage, terracotta roof, little green shrub |
| coin.png | three stacked gold guild coins embossed with a leaf symbol |
| lantern.png | a red and gold paper festival lantern |
| sword.png | a polished silver fantasy sword diagonally upright, leather grip, simple brass guard |
| banner.png | a sage green guild pennant on a wooden staff, cream leaf emblem |
| wood.png | three bundled cut wooden logs with visible growth rings |
| stone.png | a cluster of three slate grey stone chunks with blue mineral flecks |
| herb.png | a bundle of fresh green medicinal leaves tied with twine |
| bow.png | an elegant curved wooden bow with taut string and one arrow |
| staff.png | a wooden wizard staff with a glowing lavender crystal held in brass prongs |
| shield.png | a blue steel kite shield with brass border and a small leaf emblem |
| armor.png | a coral red leather adventurer tunic with a cream collar and brown belt |

Region shared prompt: “Use case: illustration-story. Asset type: wide landscape quest-region illustration for cozy Guild Master fantasy game. Create a finished hand DRAWN landscape with delicate warm dark ink outlines and opaque gouache color, clean anime storybook illustration, restrained detail legible as thumbnail, warm cream/sage/coral earthy palette adapted to scene. Wide 16:9 composition, layered foreground, middle distance, background. No frame, no text, no watermark, no UI, no people or monsters.”

| File | Subject appended to prompt |
| --- | --- |
| region-meadow.png | a winding footpath through gentle green tea meadows beside a tiny timber village, leafy oak trees, wildflowers, warm morning |
| region-ruins.png | an ancient abandoned stone bell tower in an overgrown woodland, broken mossy arches, a hanging bronze bell, afternoon amber light |
| region-mist.png | a moonlit enchanted teal forest, pale luminous plants, a narrow trail disappearing into silver mist, mysterious but cozy |
| region-canyon.png | a winding caravan trail between rusty orange cliffs, little wooden frontier camp, windswept scrub and warm late afternoon light |
| region-peak.png | a dormant volcano mountain, dark plum rocks, distant red ember glow at crater, ancient stone path and sparse pines under dramatic twilight |

## Scope

Replaces all eight dock icons, the main guild menu illustrations, four resource icons, resource reward chips, sword/bow/staff/shield/armor item categories, and all five quest-region thumbnails. Other item categories, characters, animated monsters, furniture previews and the playable world retain their existing artwork.

## Review record

Final raster assets and the integrated menu/quest screens were inspected at desktop 1365 × 900 and mobile 390 × 844. The review sheet shows all 15 icons and five regions at enlarged UI scale. Outlines, transparent edges, silhouette consistency and resource alignment were checked. The first quest crop was too soft; doubling the canvas backing resolution fixed the visible blur, and the revised mobile crop was re-inspected. Small brush details disappear at dock size, while the main silhouettes remain legible.

Validation: existing 64 tests passed; production build and standalone export passed. Chromium startup, menu navigation and all eight painted dock icons passed at desktop and mobile. Standalone mode was checked with non-navigation network requests blocked. All 20 embedded PNG payloads were also compared with their source bytes. Screenshots are in `docs/images/illustrated-*.png`.

This is a static artwork review, not a performance or animation certification. Existing character sprites, furniture previews, world rendering and UI glyphs outside the listed scope remain unchanged.
