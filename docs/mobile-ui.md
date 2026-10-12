# Mobile HUD, fullscreen and lantern timing

Phone layouts (viewport width ≤900px, height ≤500px, or a touch screen up to 1400px wide) move the existing goal card, near goals, chests, city figures and event banner into a news drawer. Its button shows the number of available items and unread news. Normal toasts are retained in the drawer; errors can show one short toast. Opening an actionable item closes the drawer before opening its destination. Time pauses while reading the drawer.

The resource strip and eight dock buttons are compact. Zoom/home controls open under the view menu; Hero details and minimap can be expanded separately. All original action handlers remain on their existing DOM nodes.

The fullscreen button requests native fullscreen and updates after fullscreenchange or Esc. Browsers that lack or reject the API use a clearly identified play mode that hides header information; this cannot hide browser chrome. Fullscreen requires a user tap.

The screenshot's black resource/goal panels and altered icon colors differ from those panels' cream CSS palette. An early `color-scheme: only light` meta tag and root CSS opt out of browser automatic darkening. Chromium was checked with dark preference and WebContentsForceDark enabled, preserving cream panels and original icons. This is browser verification, not an actual-device certification.

Lantern festivals can start at night, 18:00–06:00. Timing uses the same game clock as the calendar, which now displays a moon at night. Preparation and duration shorten when necessary to finish before dawn; starts with less than ten real seconds left before dawn are rejected without charging. Normal evening festivals preserve the existing 25-second preparation and 60-second duration. The world's dawn shading now agrees with the clock. Other festivals retain their timing rules.

Validation: 87 unit/game tests passed; build and standalone export passed. Browser checks covered 390×844 portrait, 844×390 landscape, 1280×460 wide phone and 1365×900 desktop, drawer actions, actual fullscreen enter/exit, unsupported fallback, and standalone with additional network requests blocked. Screenshots: `docs/images/mobile-ui-portrait.png` and `docs/images/mobile-ui-landscape.png`.

A follow-up color audit also found explicit dark surfaces elsewhere. Event banners, Hero status/tutorial/pack text, cooldown masks, quest art captions, market summaries, boss bars, display shelves, dungeon/show dialog shells and the Hero minimap now use warm light surfaces with dark readable text. Canvas HUDs were included: dungeon top strip, exam scorecards, tournament health tracks/bracket and harvest scoreboard. Scene lighting, night skies and modal dimming remain part of the scenery rather than UI panel backgrounds.

The browser smoke test checks secondary panel backgrounds, gradient stops and text colors under forced dark rendering across all five viewports/exports, and samples rendered dungeon, tournament and harvest HUD pixels. A panel gallery is saved at `docs/images/mobile-ui-palette.png`.
