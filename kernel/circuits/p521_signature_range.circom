pragma circom 2.1.6;

include "big_compare.circom";

/*
 * P/N521 non-zero order-range relation.
 *
 * This circuit checks the declared P/N521 operand invariant:
 *   1 <= r < n and 1 <= s < n
 */

template P521SignatureRangeMain() {
    signal input r[9];
    signal input s[9];
    signal output valid;

    component rRange = BigRangeNonZeroLtP521Order9();
    component sRange = BigRangeNonZeroLtP521Order9();

    for (var i = 0; i < 9; i++) {
        rRange.a[i] <== r[i];
        sRange.a[i] <== s[i];
    }

    valid <== rRange.valid * sRange.valid;
}

// Range proofs bind the exact candidate pair carried by the receipt.
component main { public [r, s] } = P521SignatureRangeMain();
