pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "big_limb.circom";
include "p521_params.circom";

/*
 * Reusable P/N521 order-range components.
 *
 * These templates operate on nine little-endian limbs where limbs[0..7] are
 * 64-bit and limb[8] is 9-bit.
 */

template BigLessThanP521Order9() {
    signal input a[9];
    signal output out;

    component shape = P521ArithmeticElementShape();
    component less[9];
    component eq[9];

    for (var i = 0; i < 9; i++) {
        shape.limbs[i] <== a[i];

        less[i] = LessThan(65);
        less[i].in[0] <== a[i];
        less[i].in[1] <== p521Order64(i);

        eq[i] = IsZero();
        eq[i].in <== a[i] - p521Order64(i);
    }

    signal eqPrefix[10];
    signal lessActive[9];
    signal sum[10];

    eqPrefix[9] <== 1;
    sum[0] <== 0;

    for (var j = 0; j < 9; j++) {
        var i = 8 - j;
        lessActive[i] <== eqPrefix[i + 1] * less[i].out;
        eqPrefix[i] <== eqPrefix[i + 1] * eq[i].out;
        sum[j + 1] <== sum[j] + lessActive[i];
    }

    out <== sum[9];
}

template BigLessThan9() {
    signal input a[9];
    signal input b[9];
    signal output out;

    component aShape = P521ArithmeticElementShape();
    component bShape = P521ArithmeticElementShape();
    component less[9];
    component eq[9];

    for (var i = 0; i < 9; i++) {
        aShape.limbs[i] <== a[i];
        bShape.limbs[i] <== b[i];

        less[i] = LessThan(65);
        less[i].in[0] <== a[i];
        less[i].in[1] <== b[i];

        eq[i] = IsZero();
        eq[i].in <== a[i] - b[i];
    }

    signal eqPrefix[10];
    signal lessActive[9];
    signal sum[10];

    eqPrefix[9] <== 1;
    sum[0] <== 0;

    for (var j = 0; j < 9; j++) {
        var i = 8 - j;
        lessActive[i] <== eqPrefix[i + 1] * less[i].out;
        eqPrefix[i] <== eqPrefix[i + 1] * eq[i].out;
        sum[j + 1] <== sum[j] + lessActive[i];
    }

    out <== sum[9];
}

template BigNonZero9() {
    signal input a[9];
    signal output out;

    component shape = P521ArithmeticElementShape();
    component zero[9];
    signal allZero[10];

    allZero[0] <== 1;
    for (var i = 0; i < 9; i++) {
        shape.limbs[i] <== a[i];
        zero[i] = IsZero();
        zero[i].in <== a[i];
        allZero[i + 1] <== allZero[i] * zero[i].out;
    }

    out <== 1 - allZero[9];
}

template BigRangeNonZeroLtP521Order9() {
    signal input a[9];
    signal output valid;

    component lt = BigLessThanP521Order9();
    component nz = BigNonZero9();

    for (var i = 0; i < 9; i++) {
        lt.a[i] <== a[i];
        nz.a[i] <== a[i];
    }

    valid <== lt.out * nz.out;
}
