# Self-hosted game fonts

These unmodified TrueType assets preserve the game's existing DM Sans and Libre
Caslon Display font families without requiring Google Fonts requests at runtime.
DM Sans is the official variable font; the game declares weights 400–700,
covering its previous 400, 500, 600 and 700 requests. Libre Caslon Display is the
official regular face. Both include Latin and extended Latin glyphs.

Retrieved 2026-10-22 from the authoritative Google Fonts repository, pinned to
commit `45e3d5269e4a17d823f6d84470bc084dc5ae46f6`:

- [DM Sans font](https://github.com/google/fonts/blob/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf)
- [DM Sans license](https://github.com/google/fonts/blob/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/dmsans/OFL.txt)
- [Libre Caslon Display font](https://github.com/google/fonts/blob/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/librecaslondisplay/LibreCaslonDisplay-Regular.ttf)
- [Libre Caslon Display license](https://github.com/google/fonts/blob/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/librecaslondisplay/OFL.txt)

Each font's SIL Open Font License 1.1 and copyright notice are included in its
directory as `OFL.txt` (license text preserved; line endings and trailing whitespace normalized). DM Sans's downloaded filename is simplified locally;
its binary and internal names are unchanged. No subsetting or conversion was
performed. These two files total 341,548 bytes before transfer compression.

SHA-256:

```text
8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d  dm-sans/DMSans-Variable.ttf
2340c497181e9446fcbb235e1c3780558dc62879ffe0ef47906d3f7f35cf5f35  libre-caslon-display/LibreCaslonDisplay-Regular.ttf
```

`src/fonts.css` supplies the same family names and `font-display: swap`; Vite
copies `public/fonts` into the production build. Existing font stacks and other
typographic styling remain unchanged. The application entry imports the shared
font stylesheet so all entry modes use these local assets.
