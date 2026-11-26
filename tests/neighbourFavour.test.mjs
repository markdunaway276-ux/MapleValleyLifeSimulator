import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNeighbourFavour } from '../src/systems/neighbourFavour.js';

test('the umbrella favour resumes from a save and pays only on the first handoff', () => {
  let savedStage;
  let cash = 50;
  const money = { add: (amount) => { cash += amount; } };
  let favour;
  const save = () => { savedStage = favour.serialize(); };
  favour = createNeighbourFavour({ money, save });

  assert.equal(favour.pageFor('june'), null);
  assert.equal(favour.pageFor('sam').action.run(), true);
  assert.equal(savedStage, 'offered');

  favour = createNeighbourFavour({ savedStage, money, save });
  assert.equal(favour.pageFor('june').action.run(), true);
  assert.equal(savedStage, 'relayed');

  const handoff = favour.pageFor('sam').action;
  assert.equal(handoff.run(), true);
  assert.equal(handoff.run(), false);
  assert.equal(savedStage, 'done');
  assert.equal(cash, 60);

  favour = createNeighbourFavour({ savedStage, money, save });
  assert.equal(favour.pageFor('sam').action, undefined);
  assert.equal(favour.pageFor('june').action, undefined);
});
