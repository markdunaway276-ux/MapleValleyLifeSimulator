import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSnackFavour } from '../src/systems/snackFavour.js';

test('June’s favour tracks the current step, consumes one snack, and pays once', () => {
  let count = 0;
  let paid = 0;
  let savedStage;
  const inventory = {
    serialize: () => [null, count ? { id: 'snack', count } : null],
    consume(index, amount) {
      assert.equal(index, 1);
      assert.equal(amount, 1);
      count -= amount;
      return { id: 'snack', count };
    }
  };
  const money = { add: (amount) => { paid += amount; } };
  let favour;
  const save = () => { savedStage = favour.serialize(); };
  favour = createSnackFavour({ inventory, money, save });
  assert.equal(favour.task(), null);
  assert.equal(favour.pageFor('sam'), null);
  assert.equal(favour.pageFor('june').action.run(), true);
  assert.equal(savedStage, 'accepted');

  favour = createSnackFavour({ savedStage, inventory, money, save });
  assert.match(favour.task().step, /vending machine/);
  assert.equal(favour.pageFor('june').action, undefined);
  count = 2;
  assert.match(favour.task().step, /Give June/);
  const action = favour.pageFor('june').action;
  assert.equal(action.run(), true);
  assert.equal(action.run(), false);
  assert.equal(count, 1);
  assert.equal(paid, 10);
  assert.equal(savedStage, 'done');

  favour = createSnackFavour({ savedStage, inventory, money, save });
  assert.equal(favour.task().complete, true);
  assert.equal(favour.pageFor('june').action, undefined);
});
