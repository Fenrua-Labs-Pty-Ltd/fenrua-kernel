const fs = require('fs');
const buildAdd = require('/tmp/pn521-circuit-review/p521_big_add_js/witness_calculator.js');
const buildSub = require('/tmp/pn521-circuit-review/p521_big_sub_js/witness_calculator.js');

const n = BigInt('0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409');
const two521 = 1n << 521n;
const radix = 1n << 64n;
const mask = radix - 1n;
const complement = two521 - n;
let state = 0x46454e525541n;

function next64() {
  state ^= state << 13n;
  state ^= state >> 7n;
  state ^= state << 17n;
  state &= mask;
  return state;
}
function randomN() {
  let value = 0n;
  for (let i = 0; i < 9; ++i) value |= next64() << (64n * BigInt(i));
  return value % n;
}
function limbs(value) {
  return Array.from({length: 9}, (_, i) => ((value >> (64n * BigInt(i))) & mask).toString());
}
function sameLimbs(actual, expected) {
  return JSON.stringify(actual.map(String)) === JSON.stringify(limbs(expected));
}
function addNeedsSubtract(sum) {
  const overflow = sum >= two521 ? 1n : 0n;
  const folded = (sum & (two521 - 1n)) + overflow * complement;
  return folded >= n;
}

const edgeSet = new Set([0n, 1n, 2n, 3n, n - 1n, n - 2n, n - 3n].map(String));
for (let bit = 8n; bit <= 520n; bit += 8n) {
  const power = 1n << bit;
  for (const value of [power - 2n, power - 1n, power, power + 1n, power + 2n]) {
    if (value >= 0n && value < n) edgeSet.add(value.toString());
  }
}
for (let limb = 1n; limb <= 8n; ++limb) {
  const power = 1n << (64n * limb);
  for (const value of [power - 2n, power - 1n, power, power + 1n]) {
    if (value >= 0n && value < n) edgeSet.add(value.toString());
  }
}
const allEdges = [...edgeSet].map(BigInt);
// A focused set keeps exhaustive cross-products fast while retaining every radix/top boundary.
const crossEdges = allEdges.filter((_, index) => index < 8 || index % 40 === 0 || index >= allEdges.length - 2);

(async () => {
  const addWasm = fs.readFileSync('/tmp/pn521-circuit-review/p521_big_add_js/p521_big_add.wasm');
  const subWasm = fs.readFileSync('/tmp/pn521-circuit-review/p521_big_sub_js/p521_big_sub.wasm');
  const add = await buildAdd(addWasm);
  const sub = await buildSub(subWasm);
  let addCount = 0;
  let subCount = 0;

  async function checkAdd(a, b, label) {
    const witness = await add.calculateWitness({a: limbs(a), b: limbs(b)}, 1);
    const sum = a + b;
    if (!sameLimbs(witness.slice(1, 10), sum % n)) {
      throw new Error(`add result mismatch ${label}: a=${a} b=${b}`);
    }
    if ((witness[10] === 1n) !== addNeedsSubtract(sum)) {
      throw new Error(`add needsSubtract mismatch ${label}: a=${a} b=${b}`);
    }
    ++addCount;
  }

  async function checkSub(a, b, label) {
    const witness = await sub.calculateWitness({a: limbs(a), b: limbs(b)}, 1);
    const expected = (a - b + n) % n;
    if (!sameLimbs(witness.slice(1, 10), expected)) {
      throw new Error(`sub result mismatch ${label}: a=${a} b=${b}`);
    }
    if ((witness[10] === 1n) !== (a < b)) {
      throw new Error(`sub needsAdd mismatch ${label}: a=${a} b=${b}`);
    }
    ++subCount;
  }

  const specialPairs = [
    [0n, 0n], [0n, 1n], [1n, 0n], [1n, 1n],
    [n - 1n, 1n], [n - 1n, n - 1n], [n - 2n, 2n],
    [(1n << 520n), (1n << 520n) - 1n],
    [(1n << 520n), (1n << 520n)],
    [(1n << 520n), (1n << 520n) + 1n],
    [mask, radix], [radix, mask],
  ];
  for (let limb = 1n; limb <= 8n; ++limb) {
    const power = 1n << (64n * limb);
    specialPairs.push([power - 1n, power], [power, power - 1n]);
  }
  for (const [a, b] of specialPairs) {
    await checkAdd(a, b, 'special');
    await checkSub(a, b, 'special');
  }

  for (const a of crossEdges) for (const b of crossEdges) {
    await checkAdd(a, b, 'edge-cross');
    await checkSub(a, b, 'edge-cross');
  }
  for (let i = 0; i < 500; ++i) {
    const a = randomN();
    const b = randomN();
    await checkAdd(a, b, `random-${i}`);
    await checkSub(a, b, `random-${i}`);
  }

  console.log(`PASS add=${addCount} sub=${subCount}; structured radix/top boundaries + 500 random pairs; seed 0x46454e525541`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
