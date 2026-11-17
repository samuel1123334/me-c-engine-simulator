# ME-C Engine Cutaway Simulator

### [▶ Launch the simulator (no install needed)](https://samuel1123334.github.io/me-c-engine-simulator/)

Works in current desktop browsers (Chrome, Edge, Firefox, Safari) and on phones. On a phone the 3D view stays fixed at the top with the playback bar under it, and the controls are grouped into tabs (Views · Devices · Parts · State · Info) that scroll on their own.

An **educational 3D cutaway simulator** of a MAN B&W ME-C type two-stroke crosshead marine diesel engine (6 cylinders, bore 600 mm · stroke 2400 mm) that runs in the browser. Not affiliated with MAN Energy Solutions — see the disclaimer below.

## How to run

- **On the web**: click the [Launch the simulator](https://samuel1123334.github.io/me-c-engine-simulator/) link above.
- **On your computer**: download the single file `docs/index.html` and open it in a browser. An internet connection is still needed because Three.js and the fonts load from a CDN.
- **Using it**: pick a system view or a device under "Device internals" on the left, and use the playback bar at the bottom to change crank angle, speed and load. Click any part for a description; "Self-check" at the top right shows the model checks.

## Features

- **Engine structure and motion**: true crankshaft–connecting rod–crosshead–piston kinematics, firing order 1-5-3-4-2-6, scavenge ports, exhaust valves and fuel injection timed to crank angle
- **Two-stroke cycle (0D)**: cylinder mass and energy conservation, Wiebe combustion, Woschni heat loss, nozzle flow through ports and valves
- **Turbocharger matching**: approximate compressor map, turbine ellipse law, rotor inertia, receiver dynamics, automatic start/stop of the auxiliary blowers
- **2D in-cylinder flow field**: section flow with a moving piston boundary (computed in a Web Worker)
- **System flows**: scavenge air, exhaust gas, fuel, control oil, boiler water and steam shown as particles, with cutaway and ghost-casing views and a description for every part you click
- **15 device internal views**: three-screw pumps, venting tank, fuel heater with viscosity control, duplex full-flow filter, pressure control valve, HPS swashplate piston pump, automatic back-flushing filter, HCU accumulator, FIVA valve, fuel pressure booster, exhaust valve actuator, slide-type fuel valve, exhaust valve, scavenge air cooler with water mist catcher, and auxiliary blower. Each opens as a cutaway whose internal parts and flows move with the engine state
- **15 built-in self-checks** (the "Self-check" button): mechanical return after one turn, playback vs scrubbing consistency, port timing, path connectivity, mass and energy conservation, turbo balance, HCU synchronisation, fuel system balances and more
- **GLB replacement**: select a part and load a .glb/.gltf file to drop a detailed model into the same motion slot

## Editing and building

```bash
npm install        # local Three.js (not needed for the build; used for offline testing)
npm run build      # src/ → dist/engine.html, docs/index.html
```

The files in `src/` are concatenated in name order into a single HTML file.

| File | Contents |
|---|---|
| `00_head.html` | Layout and styles |
| `10_model.js` | Dimensions, timing settings, kinematics |
| `15_thermo.js` | 0D thermodynamics, turbocharger matching |
| `16_fuelsys.js` | Fuel and control oil system state (viscosity, heater, filter, HPS, HCU) |
| `20_scene.js` – `50_flow.js` | 3D scene, part catalogue, engine geometry, piping, 2D flow field, particle flows |
| `55_detail.js` – `58_dev_valves.js` | Device internal views |
| `60_ui.js`, `70_verify.js`, `80_main.js` | User interface, self-checks, start-up |

## Model limitations (please read)

- **This is for teaching.** All pressures, temperatures and flows are values computed by simplified models, not measurements. On screen they are tagged "ref", "calc", "0D calc", "2D approx." or "edu" to show where each comes from.
- Part shapes and device internals are simplified from published descriptions of how they work. **They are not manufacturer drawings.**
- Values confirmed from public sources (e.g. fuel supply 4 bar / circulation 10 bar, injection viscosity about 13 cSt, HPS 200/300 bar, fuel valve opening pressure 350–380 bar) and values assumed for teaching (e.g. fuel grade, pump sizes, booster area ratio, accumulator volume) are listed separately in the "Sources" window and in each device's "Sources" section.
- Do not use it for real operating, maintenance or design decisions. Follow the engine's Project Guide, instruction manuals and the manufacturer's guidance.

## Disclaimer

This project is not affiliated with, endorsed by or supported by MAN Energy Solutions. "MAN B&W", "ME-C" and other product names mentioned are trademarks of their respective owners and are used only to describe the engine type. Copyright in the reference material belongs to the respective sources; this repository only links to them.

## License

[MIT](LICENSE). The external libraries [Three.js](https://threejs.org/) (MIT) and the [IBM Plex](https://github.com/IBM/plex) fonts (SIL OFL 1.1) are loaded from a CDN at run time and are not included in this repository.
