pragma circom 2.1.6;

include "big_limb.circom";

/*
 * P/N521 fixed-width shape relation.
 *
 * This circuit constrains a candidate value as
 * [192-bit lo, 192-bit mid, 137-bit hi].
 */

template P521LimbRangeMain() {
    signal input lo;
    signal input mid;
    signal input hi;
    signal output valid;

    component shape = P521ElementShape();
    shape.limbs[0] <== lo;
    shape.limbs[1] <== mid;
    shape.limbs[2] <== hi;

    valid <== shape.valid;
}

component main { public [lo, mid, hi] } = P521LimbRangeMain();
