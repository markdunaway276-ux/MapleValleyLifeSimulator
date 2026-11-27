# Maple Lane test branch notes

## Playable now

- The short Day One opening is a skippable camera tour of home, Corner Market, and the park. The sidewalk tutorial covers movement, opening the phone, and using the minimap to reach the market. Tutorial progress is saved.
- The street and park expansion includes matching road materials, a drivable service-road loop, playground, basketball court, picnic shelters, pond, footbridge, and trails.
- Selecting a saved slot opens it directly. To see the opening, choose New game in an empty slot.
- Existing first-person actions include the phone grip, door and car entry, eating, and laundry. The new hand fixes and move-in animations are pending.

## Remaining work

1. Integrate the current upgrades from `main` into `test` while preserving the park, Day One, save-slot behavior, and browser test link. The last comparison found Fuel & Go and fuel, the Surviver player model, updated neighbors and the clerk, and sprinting on `main`. Fetch both branches before integrating and test the combined build with new and existing saves.
2. Improve first-person hand contact in `src/systems/playerActions.js`. Anchor both hands to the laundry basket's grips and check pickup, carry, turning, and set-down. Aim door reaches at the actual handles and limit blocked or out-of-range reaches. Check the phone grip for regressions. The downloaded hand-animation pack has not been identified.
3. Build the longer Day One move-in sequence. Drive into town, pull up to the house, meet the realtor out front, and receive the keys during a conversation. Open the trunk, carry several boxes inside with both hands, and unpack them. Save progress at the keys and after each box. Use the realtor dialogue to set up later introductions or opportunities. The current short tutorial is the playable version.
4. Park Day is a proposed follow-up story. The park itself is already playable.

## Playtest

Publish and verify game updates on `test`. Follow [AGENTS.md](AGENTS.md) for branch rules. Use the same [phone and PC preview](https://maple-lane-playtest-git-test-mark-e095.vercel.app/) so saves stay on the same browser origin.
