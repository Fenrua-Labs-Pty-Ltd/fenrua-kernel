# P/N521 regression corpus

`regression_001_p521_sub_overflow.bin` is the exact public 132-byte
counterexample that exposed a false rejection in the initial N-order
subtraction circuit. Its encoding is `A[66] || B[66]`, unsigned big-endian,
with `A = 2^64 - 1` and `B = 2^64`.

The fix separates borrowed subtraction from conditional modulus addition, so
the signed intermediate can no longer be forced into a Boolean borrow signal.
The expected output is `(A - B) mod n = n - 1` with `needsAdd = 1`.

- Byte length: `132`
- SHA-256: `7d11e62691085056fde7193c23cc7b3ffbfde2171807f820fc94cecf6f19ee5e`
- Classification: public deterministic test input; contains no key or witness

Regenerate and verify the fixture with:

```bash
node tools/generate-regression-fixtures.mjs
```
