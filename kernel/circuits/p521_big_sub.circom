pragma circom 2.1.6;

include "big_sub.circom";

/*
 * P/N521 modular-subtraction relation.
 */

template P521BigSubMain() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsAdd;

    component sub = BigSubModP521Order9();

    for (var i = 0; i < 9; i++) {
        sub.a[i] <== a[i];
        sub.b[i] <== b[i];
    }

    for (var i = 0; i < 9; i++) {
        result[i] <== sub.result[i];
    }

    needsAdd <== sub.needsAdd;
}

// Bind the exact subtraction operands into the public statement.
component main { public [a, b] } = P521BigSubMain();
