pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "big_compare.circom";
include "big_limb.circom";
include "p521_params.circom";

/*
 * Modular addition over the P-521 curve order n.
 *
 * Representation: nine little-endian limbs, limbs[0..7] are 64-bit and
 * limbs[8] is 9-bit. The checked template constrains a,b,result < n.
 */

template Bit() {
    signal input in;
    in * (in - 1) === 0;
}

template BigAddModP521Order9Unchecked() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsSubtract;

    signal raw[9];
    signal addCarry[10];
    signal folded[9];
    signal foldCarry[10];
    signal borrow[10];

    component rawShape = P521ArithmeticElementShape();
    component foldedShape = P521ArithmeticElementShape();
    component resultShape = P521ArithmeticElementShape();
    component addCarryBits[10];
    component foldCarryBits[10];
    component borrowBits[10];

    addCarry[0] <== 0;
    foldCarry[0] <== 0;
    borrow[0] <== 0;

    for (var i = 0; i < 8; i++) {
        addCarry[i + 1] <-- (a[i] + b[i] + addCarry[i]) \ 18446744073709551616;
        raw[i] <-- (a[i] + b[i] + addCarry[i]) % 18446744073709551616;
        raw[i] + addCarry[i + 1] * 18446744073709551616 === a[i] + b[i] + addCarry[i];
    }

    addCarry[9] <-- (a[8] + b[8] + addCarry[8]) \ 512;
    raw[8] <-- (a[8] + b[8] + addCarry[8]) % 512;
    raw[8] + addCarry[9] * 512 === a[8] + b[8] + addCarry[8];

    for (var i = 0; i < 8; i++) {
        foldCarry[i + 1] <-- (raw[i] + addCarry[9] * p521OrderComplement64(i) + foldCarry[i]) \ 18446744073709551616;
        folded[i] <-- (raw[i] + addCarry[9] * p521OrderComplement64(i) + foldCarry[i]) % 18446744073709551616;
        folded[i] + foldCarry[i + 1] * 18446744073709551616 ===
            raw[i] + addCarry[9] * p521OrderComplement64(i) + foldCarry[i];
    }

    foldCarry[9] <-- (raw[8] + addCarry[9] * p521OrderComplement64(8) + foldCarry[8]) \ 512;
    folded[8] <-- (raw[8] + addCarry[9] * p521OrderComplement64(8) + foldCarry[8]) % 512;
    folded[8] + foldCarry[9] * 512 ===
        raw[8] + addCarry[9] * p521OrderComplement64(8) + foldCarry[8];

    for (var i = 0; i < 10; i++) {
        addCarryBits[i] = Bit();
        addCarryBits[i].in <== addCarry[i];
        foldCarryBits[i] = Bit();
        foldCarryBits[i].in <== foldCarry[i];
    }

    for (var i = 0; i < 9; i++) {
        rawShape.limbs[i] <== raw[i];
        foldedShape.limbs[i] <== folded[i];
    }

    // Valid normalized inputs guarantee that folding 2^521 -> 2^521 - n
    // cannot overflow a 521-bit value.
    foldCarry[9] === 0;

    component foldedLtOrder = BigLessThanP521Order9();
    for (var i = 0; i < 9; i++) {
        foldedLtOrder.a[i] <== folded[i];
    }
    needsSubtract <== 1 - foldedLtOrder.out;

    for (var i = 0; i < 8; i++) {
        borrow[i + 1] <-- (needsSubtract * p521Order64(i) + borrow[i] + 18446744073709551615 - folded[i]) \ 18446744073709551616;
        result[i] <-- folded[i] + borrow[i + 1] * 18446744073709551616 - needsSubtract * p521Order64(i) - borrow[i];
        folded[i] + borrow[i + 1] * 18446744073709551616 ===
            result[i] + needsSubtract * p521Order64(i) + borrow[i];
    }

    borrow[9] <-- (needsSubtract * p521Order64(8) + borrow[8] + 511 - folded[8]) \ 512;
    result[8] <-- folded[8] + borrow[9] * 512 - needsSubtract * p521Order64(8) - borrow[8];
    folded[8] + borrow[9] * 512 ===
        result[8] + needsSubtract * p521Order64(8) + borrow[8];

    // If subtraction is selected then folded >= n, so final borrow must clear.
    borrow[9] === 0;

    for (var i = 0; i < 10; i++) {
        borrowBits[i] = Bit();
        borrowBits[i].in <== borrow[i];
    }

    for (var i = 0; i < 9; i++) {
        resultShape.limbs[i] <== result[i];
    }
}

template BigAddModP521Order9() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsSubtract;

    component aLtOrder = BigLessThanP521Order9();
    component bLtOrder = BigLessThanP521Order9();
    component add = BigAddModP521Order9Unchecked();
    component resultLtOrder = BigLessThanP521Order9();

    for (var i = 0; i < 9; i++) {
        aLtOrder.a[i] <== a[i];
        bLtOrder.a[i] <== b[i];
        add.a[i] <== a[i];
        add.b[i] <== b[i];
    }

    for (var i = 0; i < 9; i++) {
        result[i] <== add.result[i];
        resultLtOrder.a[i] <== result[i];
    }

    aLtOrder.out === 1;
    bLtOrder.out === 1;
    resultLtOrder.out === 1;
    needsSubtract <== add.needsSubtract;
}
