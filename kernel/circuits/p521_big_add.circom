pragma circom 2.1.6;

include "big_add.circom";

/*
 * P/N521 modular-addition relation.
 *
 * Computes result = (a + b) mod n for normalized P-521-order scalars.
 */

template P521BigAddMain() {
    signal input a[9];
    signal input b[9];
    signal output result[9];
    signal output needsSubtract;

    component add = BigAddModP521Order9();

    for (var i = 0; i < 9; i++) {
        add.a[i] <== a[i];
        add.b[i] <== b[i];
    }

    for (var i = 0; i < 9; i++) {
        result[i] <== add.result[i];
    }

    needsSubtract <== add.needsSubtract;
}

// The operands are public statement inputs. A proof therefore binds the exact
// a/b pair named by its evidence receipt rather than merely proving that some
// private operands exist for the public result.
component main { public [a, b] } = P521BigAddMain();
