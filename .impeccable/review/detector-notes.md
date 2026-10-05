# Mechanical detector

Ran once on index.html and all six changed CSS files.

- Flat type hierarchy: the HTML-only scan reports 16px for every role. The
  actual CSS defines 24px brand/region titles, 18px panel titles, 15px body,
  14px controls, and 12px secondary text. This is a scanner limitation.
- Layout transition in components.css: the existing progress bar animates
  width. Preserved loading behavior; this change does not introduce it.
- Layout transitions in phone.css: the existing sheet animates height upright
  and width in landscape. The renderer uses the sheet's actual rectangle for
  anatomical framing, so replacing it with a transform would change behavior.

No mechanical errors were reported. These four warnings require contextual
review. Contrast verification passed 32 text combinations at 4.5:1 and both
control-outline palettes at 3:1; results are in contrast.json.
