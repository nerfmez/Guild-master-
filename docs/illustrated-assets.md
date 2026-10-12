# Illustrated UI artwork

Revision of PR #12 (`codex/illustrated-ui-assets`): the 15 illustrated icons now use simpler silhouettes, fewer interior lines, consistent warm outlines and muted cream, sage, ochre and terracotta colors. The five region thumbnails are loose watercolor paintings with broad pigment washes and soft atmospheric layers instead of detailed ink-and-gouache scenery.

Assets live in `assets/illustrated/`. Icons are 192 × 192 with transparent backgrounds; regions are 640 × 360. The PNGs use a 256-color palette. Existing filenames, canvas layout and image-loading behavior are preserved. `scripts/export.mjs` embeds the exact files in standalone `play.html`.

## Artwork creation

The previous PR review sheet was used as the Imagegen reference. Two revised sheets were generated: a 5 × 3 icon sheet and a 2 × 3 landscape sheet with an unused last cell. ImageMagick sliced the sheets, resized the deliverables and optimized PNG palettes; it did not paint or filter the illustration style.

Icon direction: simple flat shapes, consistent warm rounded outlines, restrained earthy colors, no fine ornaments or realistic material textures. Order: hammer, scroll, people, house, coin; lantern, sword, banner, wood, stone; herb, bow, staff, shield, armor.

Landscape direction: loose watercolor with broad translucent pigment washes, warm paper and soft edges; fewer foliage, masonry and ground details. Preserve each region's identity: green meadow and cottages, broken bell tower, misty teal forest, rusty canyon and frontier tent, plum volcanic peak at twilight.

## Scope

Replaces all eight dock icons, the main guild menu illustrations, four resource icons, resource reward chips, sword/bow/staff/shield/armor item categories, and all five quest-region thumbnails. Other item categories, characters, animated monsters, furniture previews and the playable world retain their existing artwork.

## Review record

All 20 revised assets were visually inspected. `docs/images/illustrated-art-review.png` shows the replacement artwork; transparent icons were also checked on the cream UI background. Navigation and region screenshot checks are recorded separately from the unchanged gameplay simulation tests.

Validation: 64 existing tests passed; production build and standalone export passed. Browser checks at 1365 × 900 and 390 × 844 confirmed all 20 assets paint successfully, menu images load, and the revised artwork appears in the menu and quest board. All 20 standalone embedded PNG payloads match the source files byte for byte.
