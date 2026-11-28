/**
 * Weather- & Season-Reactive Neighbour Odd Jobs.
 *
 * Gives Maple Lane residents repeatable daily odd jobs that respond to live
 * weather (snow shoveling during cold/snowy spells, yard cleanup in mild
 * weather, and pickup haul runs for Vince & Dottie) with zero extra buildings.
 */

export const ODD_JOBS = Object.freeze([
  {
    id: 'snow-shovel',
    title: 'Snow Shoveling',
    npcs: ['sam', 'june'],
    condition: 'snow',
    pay: 28,
    minutes: 35,
    energyCost: 14,
    fitnessXp: 10,
    friendship: 8,
    promptLine: 'Snow is piling up along the walk! Want to earn $28 helping me shovel it clear?',
    actionLabel: 'Shovel walkway (+$28 · 35m)',
    doneLine: "Whew, that looks ten times safer! Here's $28 — appreciate the muscle."
  },
  {
    id: 'yard-cleanup',
    title: 'Yard Cleanup',
    npcs: ['walt', 'june'],
    condition: 'mild',
    pay: 22,
    minutes: 30,
    energyCost: 12,
    fitnessXp: 8,
    friendship: 8,
    promptLine: 'Wind blew leaves and twigs all over the lot. Got 30 minutes to help tidy up for $22?',
    actionLabel: 'Help with yard cleanup (+$22 · 30m)',
    doneLine: "Spotless! Here's $22 for the help — you're a real lifesaver around here."
  },
  {
    id: 'haul-run',
    title: 'Supply Haul Run',
    npcs: ['vince', 'dottie'],
    condition: 'any',
    pay: 32,
    minutes: 40,
    energyCost: 15,
    fitnessXp: 10,
    friendship: 10,
    promptLine: 'Got heavy supply crates sitting out back that need hauling. Care to lend a hand for $32?',
    actionLabel: 'Haul supply crates (+$32 · 40m)',
    doneLine: "That saved my back! Here's $32 — swing by tomorrow if you want another run."
  }
]);

export function createOddJobs({
  clock = null,
  weather = null,
  needs = null,
  money = null,
  skills = null,
  friendship = null,
  sfx = null,
  toast = () => {},
  save = () => {}
} = {}) {
  const lastDoneDay = Object.create(null);
  let completedCount = 0;

  function currentDay() {
    const t = clock?.getTime?.();
    return Math.max(1, Number(t?.day) | 0 || 1);
  }

  function isSnowyWeather() {
    if (!weather) return false;
    const snowCover = typeof weather.snowCover === 'function' ? Number(weather.snowCover()) : 0;
    const snowfall = typeof weather.snowAmount === 'function' ? Number(weather.snowAmount()) : 0;
    const snap = typeof weather.get === 'function' ? weather.get() : null;
    // weather.get() reports Fahrenheit as `tempF`.
    const tempF = snap && typeof snap.tempF === 'number' ? snap.tempF : 60;
    return snowCover >= 0.15 || snowfall >= 0.1 || tempF <= 37;
  }

  function isAvailable(jobId) {
    const job = ODD_JOBS.find((j) => j.id === jobId);
    if (!job) return false;
    if (lastDoneDay[job.id] === currentDay()) return false;
    const snowy = isSnowyWeather();
    if (job.condition === 'snow' && !snowy) return false;
    if (job.condition === 'mild' && snowy) return false;
    return true;
  }

  function runJob(jobId, npcId = null) {
    const job = ODD_JOBS.find((j) => j.id === jobId);
    if (!job || !isAvailable(jobId)) return false;

    const energy = needs && typeof needs.get === 'function' ? Number(needs.get('energy')) : 100;
    if (Number.isFinite(energy) && energy < job.energyCost) {
      toast('Too tired for an odd job — grab a coffee or rest first.');
      sfx?.play?.('click');
      return false;
    }

    clock?.advance?.(job.minutes);
    needs?.add?.('energy', -job.energyCost);
    money?.add?.(job.pay, { category: 'Odd Job', label: job.title });
    skills?.addXp?.('fitness', job.fitnessXp);
    const targetNpc = npcId || job.npcs[0];
    if (targetNpc) friendship?.add?.(targetNpc, job.friendship);

    lastDoneDay[job.id] = currentDay();
    completedCount += 1;
    sfx?.play?.('pickup');
    toast(`${job.title} done! (+$${job.pay} · +${job.fitnessXp} Fitness XP)`);
    save?.();
    return true;
  }

  function pageFor(npcId) {
    const id = String(npcId || '').toLowerCase();
    for (let i = 0; i < ODD_JOBS.length; i++) {
      const job = ODD_JOBS[i];
      if (!job.npcs.includes(id)) continue;
      if (!isAvailable(job.id)) continue;
      return {
        lines: [job.promptLine],
        action: {
          label: job.actionLabel,
          run: () => runJob(job.id, id)
        },
        response: [job.doneLine]
      };
    }
    return null;
  }

  function serialize() {
    return {
      completedCount,
      lastDoneDay: { ...lastDoneDay }
    };
  }

  function apply(data) {
    const src = data?.oddJobs;
    if (!src || typeof src !== 'object') return;
    completedCount = Math.max(0, Number(src.completedCount) | 0);
    if (src.lastDoneDay && typeof src.lastDoneDay === 'object') {
      for (const [k, v] of Object.entries(src.lastDoneDay)) {
        lastDoneDay[k] = Number(v) | 0;
      }
    }
  }

  return {
    jobs: ODD_JOBS,
    isSnowyWeather,
    isAvailable,
    runJob,
    pageFor,
    getStats: () => ({ completedCount }),
    serialize,
    apply
  };
}
