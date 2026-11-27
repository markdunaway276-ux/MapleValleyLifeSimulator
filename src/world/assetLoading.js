import { LoadingManager } from 'three';

export const worldAssets = new LoadingManager();
let started = 0;
let finished = 0;
const itemStart = worldAssets.itemStart.bind(worldAssets);
const itemEnd = worldAssets.itemEnd.bind(worldAssets);
worldAssets.itemStart = url => { started++; itemStart(url); };
worldAssets.itemEnd = url => { finished++; itemEnd(url); };

export function assetLoadState() {
  return { started, finished };
}
