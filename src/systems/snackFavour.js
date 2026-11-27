export function createSnackFavour({ savedStage, inventory, money, save }) {
  let stage = ['accepted', 'done'].includes(savedStage) ? savedStage : 'new';
  const snackIndex = () => inventory.serialize().findIndex((item) => item?.id === 'snack');

  function accept() {
    if (stage !== 'new') return false;
    stage = 'accepted';
    save();
    return true;
  }

  function deliver() {
    if (stage !== 'accepted') return false;
    const index = snackIndex();
    if (index < 0 || !inventory.consume(index, 1)) return false;
    stage = 'done';
    money.add(10, { category: 'Reward', label: 'Snack for June' });
    save();
    return true;
  }

  function pageFor(npcId) {
    if (npcId !== 'june') return null;
    if (stage === 'new') {
      return {
        lines: ["Would you bring me a snack? The vending machine across the street sells them for $5."],
        action: { label: 'I can bring one', run: accept },
        response: ["Thanks! A snack from your bag is fine too."]
      };
    }
    if (stage === 'done') return { lines: ["Thanks again for bringing me that snack."] };
    if (snackIndex() < 0) return { lines: ["The vending machine across the street should have a snack."] };
    return {
      lines: ["Did you bring a snack?"],
      action: { label: 'Give one snack', run: deliver },
      response: ["Thanks! Here’s $10 for the snack and your trouble."]
    };
  }

  function task() {
    if (stage === 'new') return null;
    return {
      id: 'snack',
      title: 'A snack for June',
      complete: stage === 'done',
      npcId: 'june',
      step: snackIndex() < 0
        ? 'Get a snack from the vending machine across the street.'
        : 'Give June one snack.'
    };
  }

  return { pageFor, task, serialize: () => stage };
}
