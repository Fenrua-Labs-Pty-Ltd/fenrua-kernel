pragma circom 2.1.6;

include "circomlib/circuits/bitify.circom";
include "p521_params.circom";

/*
 * Limb-shape constraints for 521-bit P-521 values.
 *
 * This file intentionally constrains only the selected fixed-width P/N521
 * encodings. It makes no claim beyond limb shape.
 */

template P521ElementShape() {
    signal input limbs[3];
    signal output valid;

    component loBits = Num2Bits(p521LimbBits());
    component midBits = Num2Bits(p521LimbBits());
    component hiBits = Num2Bits(p521TopLimbBits());

    loBits.in <== limbs[0];
    midBits.in <== limbs[1];
    hiBits.in <== limbs[2];

    valid <== 1;
}

template P521ArithmeticElementShape() {
    signal input limbs[9];
    signal output valid;

    component limbBits[8];
    for (var i = 0; i < 8; i++) {
        limbBits[i] = Num2Bits(p521ArithmeticLimbBits());
        limbBits[i].in <== limbs[i];
    }

    component hiBits = Num2Bits(p521ArithmeticTopLimbBits());
    hiBits.in <== limbs[8];

    valid <== 1;
}
