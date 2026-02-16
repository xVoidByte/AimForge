# AimForge Training Lab

AimForge is a web aim trainer designed to improve precision and reaction speed for competitive FPS games like Valorant, CS2, Apex Legends, Rust & more. No downloads/setups required unless you wish to contribute to the project as a developer, just play and practice.

<img width="2559" height="1439" alt="image" src="https://github.com/user-attachments/assets/91f435c2-ac23-462c-83e2-50106ee5dc1a" />

## Current Features

- *Snap Tiles*: Single target respawns instantly (flick + first-shot precision)
- *Wall Cluster*: Multi-target switching with 6 simultaneous targets
- *Strafe Trail*: Moving target tracking (passive or mouse hold-fire modes)

I am open to implement more features as long as you can give me a video example or a well written PR with the request :)

## Controls

- **Esc**: Return to menu (during a session)
- **P**: Pause/resume
- **F**: Fullscreen toggle

*Note for Devs: there is a hidden No Clip feature for debugging/testing purposes if you wish to contribute*

## Requirements

- Modern web browser with WebGL support
- Mouse (duuh)

## Run Locally

**AS A NORMAL USER, IGNORE THIS PART, THIS IS INTENDED FOR DEVELOPERS**

Start a local web server in the project directory:

```bash
python -m http.server 1337
```

Then open `http://localhost:1337` in your browser.

## Notes

Internet connection is required by default because `three` is loaded from a CDN in `index.html`. If you want fully offline use, replace the import map entries with local files.

## Credits

Built with [Three.js](https://threejs.org/)
