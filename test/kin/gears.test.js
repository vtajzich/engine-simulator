import { describe, it, expect } from 'vitest';
import { SPEC } from '../../src/spec.js';
import { derive } from '../../src/kin/derive.js';
import * as G from '../../src/kin/gears.js';

const D = derive(), GB = D.gearbox, gs = GB.gears;
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

describe('gear geometry', () => {
  it('centre distance 76.04', () => { expect(Math.abs(GB.centreDistance - 76.04)).toBeLessThan(0.01); });
  it('every helical pair meshes at the centre distance', () => {
    for (const p of ['input', 'g1', 'g2', 'g3', 'g5']) {
      expect(gs[`${p}.main`].r + gs[`${p}.counter`].r).toBeCloseTo(GB.centreDistance, 9);
      expect(gs[`${p}.main`].hand).toBe(1); expect(gs[`${p}.counter`].hand).toBe(-1);
    }
  });
  it('reverse train distances and tip clearance', () => {
    const i = GB.idlerAxis;
    expect(Math.hypot(i.y + GB.centreDistance, i.z)).toBeCloseTo(gs['rev.counter'].r + gs['rev.idler'].r, 9);
    expect(Math.hypot(i.y, i.z)).toBeCloseTo(gs['rev.main'].r + gs['rev.idler'].r, 9);
    expect(gs['rev.counter'].ra + gs['rev.main'].ra).toBeLessThan(GB.centreDistance - 1);
  });
  it('minimum tooth counts', () => {
    const zmin = Math.ceil(2 * Math.cos(GB.beta) / Math.sin(GB.alphaT) ** 2);
    for (const [id, g] of Object.entries(gs)) {
      if (g.beta) expect(g.z).toBeGreaterThanOrEqual(zmin); else expect(g.z).toBeGreaterThanOrEqual(17);
    }
  });
  it('toothHalfAngle decreases with radius, equal below base circle', () => {
    const g = gs['g1.main'];
    expect(G.toothHalfAngle(g, g.rb * 0.9)).toBeCloseTo(G.toothHalfAngle(g, g.rb), 12);
    expect(G.toothHalfAngle(g, g.ra)).toBeLessThan(G.toothHalfAngle(g, g.r));
  });
});

describe('ratios', () => {
  it('values', () => {
    const want = { 1: 3.353, 2: 1.927, 3: 1.287, 4: 1, 5: 0.769, R: -3.758 };
    for (const [k, v] of Object.entries(want)) expect(Math.abs(GB.ratios[k] - v)).toBeLessThan(0.002);
  });
});

describe('mesh phase', () => {
  it('pA + pB = 0.5 mod 1', () => {
    const r = rng(7), frac = v => v - Math.floor(v);
    for (let n = 0; n < 200; n++) {
      const zA = 17 + Math.floor(r() * 40), zB = 17 + Math.floor(r() * 40);
      const thA = (r() - 0.5) * 20, delta = (r() - 0.5) * 6;
      const thB = G.meshPhase(zA, thA, zB, delta);
      const pA = frac((delta - thA) * zA / (2 * Math.PI));
      const pB = frac((delta + Math.PI - thB) * zB / (2 * Math.PI));
      const s = frac(pA + pB);
      expect(Math.min(Math.abs(s - 0.5), 1)).toBeLessThan(1e-9);
    }
  });
  it('shaftAngles are linear with the right slopes', () => {
    const f = x => G.shaftAngles({ input: x, main: 0 });
    const a = f(0), b = f(1), c = f(2.5);
    for (const k of ['counter', 'g1', 'g2', 'g3', 'g5', 'idler']) {
      expect(c[k] - a[k]).toBeCloseTo(2.5 * (b[k] - a[k]), 9);
    }
    expect(b.counter - a.counter).toBeCloseTo(-34 / 46, 9);
    expect(b.g1 - a.g1).toBeCloseTo((34 / 46) * (23 / 57), 9);
    expect(b.g5 - a.g5).toBeCloseTo((34 / 46) * (51 / 29), 9);
    expect(b.idler - a.idler).toBeCloseTo((34 / 46) * (18 / 22), 9);
    expect(b.revMainRequired - a.revMainRequired).toBeLessThan(0);
  });
  it('directions: forward gears with input, counter and reverse output against it', () => {
    for (const k of ['g1', 'g2', 'g3', 'g5', 'idler']) expect(G.gearLinear(k).A).toBeGreaterThan(0);
    expect(G.gearLinear('counter').A).toBeLessThan(0);
    expect(G.gearLinear('revMain').A).toBeLessThan(0);
    expect(G.gearLinear('input')).toEqual({ A: 1, B: 0 });
  });
  it('gearLinear agrees with shaftAngles', () => {
    const s = G.shaftAngles({ input: 3.3, main: 0 });
    for (const k of ['counter', 'g1', 'g2', 'g3', 'g5', 'idler']) {
      const { A, B } = G.gearLinear(k);
      expect(A * 3.3 + B).toBeCloseTo(s[k], 12);
    }
  });
  it('gear tables', () => {
    expect(G.gearForSleeve.s12['-1']).toBe('g2'); expect(G.gearForSleeve.s34['-1']).toBe('input');
    expect(G.gearNumber.input).toBe('4'); expect(G.ringForGear.input).toBe('ring4');
  });
});
