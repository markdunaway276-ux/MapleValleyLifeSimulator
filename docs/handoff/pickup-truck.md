# Pickup truck (player car) — handoff

`assets/models/vehicles/pickup.glb` replaces the box-built sedan from `createParkedCar()` in `src/world/props.js` as the player's car, both in the Route 9 opening and in normal driving. Credit is already in `assets/models/CREDITS.md`. In game, call it "your pickup" or "the truck", never by its real make or model.

## The file (about 4.7 MB, about 111k triangles)

- Metres, Y up, **front = +x**, **left (driver) side = -z**, origin = ground centre. That matches the current car's frame.
- Size: 5.35 m long, 2.19 m wide (mirror to mirror), 1.93 m tall. Bigger than the sedan (`CAR_SIZE` 4.0 × 1.85), so update `CAR_SIZE` and check parking spots, collision, carBounds and the gas forecourt.
- Nodes:
  - `truck-body`: whole exterior. Paint material is `body` (pure black in the file; set a colour in code if wanted). Glass materials (`glass`, `d_glass`, `r_glass`) are BLEND.
  - `truck-interior`: dashboard, seats and steering wheel. Left-hand drive; the steering wheel is on the -z side.
  - `wheel-fl` (1.785, 0.386, -0.764), `wheel-fr` (1.785, 0.386, 0.764), `wheel-rl` (-1.229, 0.385, -0.752), `wheel-rr` (-1.229, 0.385, 0.752). Each wheel's origin is its hub, so it can spin in place. The tyre radius is about 0.386 m. Roll about the local z axle: angle = -distance / 0.386 (moving +x).
- Driver eye point: about (0.15, 1.40, -0.42). Tune it so the view clears the steering wheel. `CAR_SEAT` needs updating.

## Wiring notes

- Name each wheel `car-wheel` (or update `roadTrip.js`, which finds wheels by that name). Put each wheel in a pivot group: steering yaw on the pivot, rolling on the wheel.
- The truck has its own interior. Either drop the hand-built `carInterior.js` cabin or keep only its moving parts (gauges, boxes), placed in the truck. Re-place the steering-wheel grip points (`g.cabin.grips`) on the truck's steering wheel.
- The moving boxes can now ride in the truck bed (bed floor at about x -2.5 … -1.0, y ≈ 0.95), which makes sense for Day One's unload step ("stand behind the car").
- Load it with `loadGltf` and keep a simple fallback (the old sedan) while it loads.
