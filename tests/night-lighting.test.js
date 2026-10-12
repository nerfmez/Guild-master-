import test from 'node:test';
import assert from 'node:assert/strict';
import {nightAmount} from '../src/night-lighting.js';
test('night shading spans midnight continuously and daylight has no lamps',()=>{
 assert.equal(nightAmount(0),1);assert.equal(nightAmount(239.99),1);assert.equal(nightAmount(240),1);
 for(const clock of [60,90,120,150,172.8])assert.ok(nightAmount(clock)<1e-12);
});
test('dawn and dusk fade without a lighting jump',()=>{
 assert.ok(Math.abs(nightAmount(48)-nightAmount(48.0001))<.001);
 assert.ok(Math.abs(nightAmount(60)-nightAmount(59.9999))<.001);
 assert.ok(Math.abs(nightAmount(172.8)-nightAmount(172.8001))<.001);
 assert.ok(Math.abs(nightAmount(192)-nightAmount(191.9999))<.001);
 assert.ok(nightAmount(54)>.49&&nightAmount(54)<.51);
 assert.ok(nightAmount(182.4)>.49&&nightAmount(182.4)<.51);
});
