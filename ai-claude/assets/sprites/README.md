<!-- AI-GENERATED (Claude, 2026-10-29) - see AI_CONTRIBUTIONS.md -->
# Sprites (optional)

Drop PNG images here to replace the plain shapes in the animation.
The file name must match a food type name from `raccoon/config.py`, or one of
the two special names:

| File            | Replaces                        |
|-----------------|---------------------------------|
| `raccoon.png`   | the raccoon (dark circle)       |
| `den.png`       | the den (brown square)          |
| `fish.png`      | fish (aqua diamond)             |
| `blueberries.png` | blueberries (violet hexagon)  |
| `pizza.png`     | pizza (yellow triangle)         |
| `apple.png`     | apple (green circle)            |
| `donut.png`     | donut (pink pentagon)           |

Any image that is missing falls back to its shape, so you can add them one at a time.
Square images with a transparent background work best. If they come out too big
or too small, change `SPRITE_ZOOM` in `raccoon/visuals/theme.py`.
Only use images you made yourselves or have the rights to use.
