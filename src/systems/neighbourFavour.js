const RESPONSES = {
  offer: [
    "Could you tell June her umbrella is at my place? She left it here yesterday.",
    "She's usually on the sidewalk across the street."
  ],
  looking: ["June's usually across the street. Would you let her know about the umbrella?"],
  message: ["Hi! Did Sam have a message for me?"],
  reply: ["So that's where I left it! Could you tell Sam I'll pick it up tomorrow?"],
  return: ["Did you get a chance to talk to June?"],
  thanks: ["Thanks for passing that along. Here’s $10 for your trouble."],
  samDone: ["Thanks again for helping with June's umbrella."],
  juneDone: ["I'll pick up my umbrella from Sam tomorrow. Thanks for letting me know!"]
};

export function createNeighbourFavour({ savedStage, money, save }) {
  let stage = ['offered', 'relayed', 'done'].includes(savedStage) ? savedStage : 'new';

  function advance(expected, next, reward = 0) {
    if (stage !== expected) return false;
    stage = next;
    if (reward) money.add(reward);
    save();
    return true;
  }

  function pageFor(npcId) {
    if (npcId === 'sam') {
      if (stage === 'new') return {
        lines: RESPONSES.offer,
        action: { label: "I'll tell June", run: () => advance('new', 'offered') },
        response: ["Thanks. You should find her across the street."]
      };
      if (stage === 'offered') return { lines: RESPONSES.looking };
      if (stage === 'relayed') return {
        lines: RESPONSES.return,
        action: { label: 'Pass on her reply', run: () => advance('relayed', 'done', 10) },
        response: RESPONSES.thanks
      };
      return { lines: RESPONSES.samDone };
    }
    if (npcId !== 'june' || stage === 'new') return null;
    if (stage === 'offered') return {
      lines: RESPONSES.message,
      action: { label: 'Tell her about the umbrella', run: () => advance('offered', 'relayed') },
      response: RESPONSES.reply
    };
    return { lines: stage === 'relayed' ? RESPONSES.reply : RESPONSES.juneDone };
  }

  return { pageFor, serialize: () => stage };
}
