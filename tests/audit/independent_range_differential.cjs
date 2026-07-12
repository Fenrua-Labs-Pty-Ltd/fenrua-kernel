const fs = require('fs');
const buildWitness = require('/tmp/pn521-circuit-review/p521_signature_range_js/witness_calculator.js');
const n = BigInt('0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409');
const mask = (1n << 64n) - 1n;
const max = (1n << 521n) - 1n;
let state = 0x46454e525541n;
function next64() { state ^= state << 13n; state ^= state >> 7n; state ^= state << 17n; state &= mask; return state; }
function random521() { let x=0n; for(let i=0;i<9;i++) x |= next64() << (64n*BigInt(i)); return x & max; }
function limbs(x) { return Array.from({length:9},(_,i)=>((x>>(64n*BigInt(i)))&mask).toString()); }
(async()=>{
 const wasm=fs.readFileSync('/tmp/pn521-circuit-review/p521_signature_range_js/p521_signature_range.wasm');
 const wc=await buildWitness(wasm);
 const edges=[0n,1n,2n,n-2n,n-1n,n,n+1n,max-1n,max]; let count=0;
 async function check(r,s,label){const w=await wc.calculateWitness({r:limbs(r),s:limbs(s)},1); const want=r>0n&&r<n&&s>0n&&s<n; if((w[1]===1n)!==want)throw new Error(`${label} r=${r} s=${s}`);count++;}
 for(const r of edges)for(const s of edges)await check(r,s,'edge');
 for(let i=0;i<1000;i++)await check(random521(),random521(),`random-${i}`);
 console.log(`PASS ${count} N521 range pairs; seed 0x46454e525541`);
})().catch(e=>{console.error(e);process.exitCode=1});
