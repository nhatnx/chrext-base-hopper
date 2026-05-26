# Extension Icons

This directory contains the extension icons in different sizes as required by Chrome:

- `icon16.png` - 16x16 pixels (browser toolbar)
- `icon48.png` - 48x48 pixels (extensions page)
- `icon128.png` - 128x128 pixels (Chrome Web Store, installation)

## Creating Custom Icons

Replace these placeholder images with your own custom icons. You can create icons using:
- **Online tools**: Canva, Figma, or icon generators
- **Design software**: Adobe Illustrator, Photoshop, or GIMP
- **Icon fonts**: Font Awesome, Material Icons, etc.

## Requirements

- PNG format
- Transparent background recommended
- Square aspect ratio
- Sizes: 16x16, 48x48, and 128x128 pixels

## Quick Icon Generation

You can use ImageMagick to create icons from SVG:

```bash
convert icon.svg -resize 128x128 icon128.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 16x16 icon16.png
```

Or use online tools like:
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/
