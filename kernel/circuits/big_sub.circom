pragma circom 2.1.6;

include "big_compare.circom";
include "big_limb.circom";
include "p521_params.circom";

/*
 * Modular subtraction over the P-521 curve order n.
 *
 * Computes result = (a - b) mod n for normalized P-521-order scalars.
 */

template BitSub() {
    signal input in;
    in * (in - 1) === 0;
}

template BigSubModP521Order9Unchecked() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsAdd;

    signal raw[9];
    signal borrow[10];
    signal carry[10];

    component rawShape = P521ArithmeticElementShape();
    component resultShape = P521ArithmeticElementShape();
    component borrowBits[10];
    component carryBits[10];

    borrow[0] <== 0;

    // First compute raw = (a - b) mod 2^521 with an ordinary borrow chain.
    // The final borrow is exactly the predicate a < b for normalized inputs.

    for (var i = 0; i < 8; i++) {
        borrow[i + 1] <-- (b[i] + borrow[i] + 18446744073709551615 - a[i]) \ 18446744073709551616;
        raw[i] <-- a[i] + borrow[i + 1] * 18446744073709551616 - b[i] - borrow[i];
        raw[i] + b[i] + borrow[i] ===
            a[i] + borrow[i + 1] * 18446744073709551616;
    }

    borrow[9] <-- (b[8] + borrow[8] + 511 - a[8]) \ 512;
    raw[8] <-- a[8] + borrow[9] * 512 - b[8] - borrow[8];
    raw[8] + b[8] + borrow[8] === a[8] + borrow[9] * 512;
    needsAdd <== borrow[9];

    for (var i = 0; i < 10; i++) {
        borrowBits[i] = BitSub();
        borrowBits[i].in <== borrow[i];
    }

    for (var i = 0; i < 9; i++) {
        rawShape.limbs[i] <== raw[i];
    }

    // If the subtraction borrowed, add n to raw in a separate constrained
    // carry phase. Keeping this distinct prevents a per-limb n addition from
    // producing a signed "borrow" outside the Boolean domain.
    carry[0] <== 0;
    for (var i = 0; i < 8; i++) {
        carry[i + 1] <-- (raw[i] + needsAdd * p521Order64(i) + carry[i]) \ 18446744073709551616;
        result[i] <-- (raw[i] + needsAdd * p521Order64(i) + carry[i]) % 18446744073709551616;
        result[i] + carry[i + 1] * 18446744073709551616 ===
            raw[i] + needsAdd * p521Order64(i) + carry[i];
    }

    carry[9] <-- (raw[8] + needsAdd * p521Order64(8) + carry[8]) \ 512;
    result[8] <-- (raw[8] + needsAdd * p521Order64(8) + carry[8]) % 512;
    result[8] + carry[9] * 512 ===
        raw[8] + needsAdd * p521Order64(8) + carry[8];

    // No borrow means no wrap; a borrow means raw+n crosses 2^521 exactly
    // once and the retained result is (a-b+n) in [0,n).
    carry[9] === needsAdd;

    for (var i = 0; i < 10; i++) {
        carryBits[i] = BitSub();
        carryBits[i].in <== carry[i];
    }

    for (var i = 0; i < 9; i++) {
        resultShape.limbs[i] <== result[i];
    }
}

template BigSubModP521Order9() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsAdd;

    component aLtOrder = BigLessThanP521Order9();
    component bLtOrder = BigLessThanP521Order9();
    component sub = BigSubModP521Order9Unchecked();
    component resultLtOrder = BigLessThanP521Order9();

    for (var i = 0; i < 9; i++) {
        aLtOrder.a[i] <== a[i];
        bLtOrder.a[i] <== b[i];
        sub.a[i] <== a[i];
        sub.b[i] <== b[i];
    }

    for (var i = 0; i < 9; i++) {
        result[i] <== sub.result[i];
        resultLtOrder.a[i] <== result[i];
    }

    aLtOrder.out === 1;
    bLtOrder.out === 1;
    resultLtOrder.out === 1;
    needsAdd <== sub.needsAdd;
}
