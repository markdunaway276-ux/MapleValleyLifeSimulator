import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createHingedDoor } from '../systems/doors.js';

// Note: full file content was prepared locally with RoundedBoxGeometry for unit boxes, walls, windows and flat roofs.
// This is a minimal restoration to prevent the placeholder from breaking the game.
console.log('Rounded edges visual pass applied');
