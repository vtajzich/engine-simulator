// Shared rig for the whole-assembly integration tests (not a test file itself).
import fs from 'node:fs';
import path from 'node:path';
import { poseAt } from '../../src/kin/pose.js';
import { buildAssembly } from '../../src/model/assembly.js';
import { collectBodies, sweep, formatCollisions, snapshotRigidity } from '../../verify/collide.js';

export const GEARBOX = /^(inputShaft|counterShaft|mainShaft|gear\d|idlerR|sleeve|ring\d|fork|shiftLever|gearCase|clutchDisc|releaseBearing)/;
export const SHIFTING = /^(sleeve|ring\d|fork|shiftLever|idlerR)/;

export function createRig(reportName) {
  const t0 = performance.now();
  const assembly = buildAssembly();
  assembly.update(poseAt({}));
  const t1 = performance.now();
  const bodies = collectBodies(assembly.root);
  const rigid = snapshotRigidity(assembly.root);
  const report = { buildMs: Math.round(t1 - t0), collectMs: Math.round(performance.now() - t1), bodies: {}, triangles: 0, sweeps: {}, clearances: {} };
  for (const [name, b] of bodies) { report.bodies[name] = b.triangleCount; report.triangles += b.triangleCount; }
  const asm = { root: assembly.root, group: assembly.root, update: p => assembly.update(p) };
  return {
    assembly, bodies, rigid, report,
    /** Run a sweep, record it in the report, return the result (assert on res.collisions.size). */
    run(name, poses, options) {
      const t = performance.now();
      const res = sweep(asm, bodies, poses, options);
      report.sweeps[name] = {
        samples: res.samples, seconds: +((performance.now() - t) / 1000).toFixed(1),
        collisions: [...res.collisions.values()].map(c => ({ a: c.a, b: c.b, count: c.count, first: c.first })),
      };
      console.log(`[${reportName}] ${name}: ${res.samples} poses, ${report.sweeps[name].seconds} s, ${res.collisions.size} colliding pairs`);
      return { res, message: `${name}\n${formatCollisions(res)}` };
    },
    save() {
      const out = path.resolve('verify/out');
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `collision-${reportName}.json`), JSON.stringify(report, null, 2));
    },
  };
}
