# Warm nights and building lights

Night uses a soft blue shade with readable paths and a restrained vignette. The grade stays consistent across midnight and fades into sunrise/sunset. Warm orange light comes from real window glass and entrance lanterns, with small pools on the ground. Existing window frames, shutters and shop displays remain visible.

Lighting covers the guild hall, decorative cottages, all village home/business styles, the dojo, market stalls, arena, fairground, stage and monument. Farm barns, windmills and watch posts also receive lights; campfires and frontier camps cast a wider warm glow at night. Lights fade out in daylight. Scene-only mode keeps the lighting visible without bringing back the HUD.

Light locations use each sprite's coordinates, so the layers follow relocation, mirrored buildings and construction animations. Pane and halo textures are baked once and reused, while visibility follows the source building's culling. Removed/rebuilt buildings discard their layers. This works in WebGL and the Canvas fallback; standalone includes the same lighting module.

Validation: six night transition/lantern timing checks, build/export, Canvas/WebGL/standalone browser checks for day/night contrast, daylight shutoff, building coverage, relocated/mirrored houses and layer reuse. Standalone mobile scenery/fullscreen checks also passed. The rendered nighttime scene stays around 61% of the average daylight luminance in the test town. These are browser checks, not physical-device measurements.

Screenshots: `docs/images/warm-night-day.png` and `docs/images/warm-night.png`.
