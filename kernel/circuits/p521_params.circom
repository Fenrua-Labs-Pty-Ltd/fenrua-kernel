pragma circom 2.1.6;

/*
 * P-521 constants split into [lo, mid, hi] limbs with radix 2^192.
 * The top limb is constrained to 137 bits for 521-bit values.
 *
 * Source cross-check: OpenSSL secp521r1 explicit parameters.
 * These helpers define numeric-domain constants only. Each consuming P/N521
 * relation must state separately what property it constrains.
 */

function p521LimbBits() {
    return 192;
}

function p521TopLimbBits() {
    return 137;
}

function p521ArithmeticLimbs() {
    return 9;
}

function p521ArithmeticLimbBits() {
    return 64;
}

function p521ArithmeticTopLimbBits() {
    return 9;
}

function p521FieldPrime(idx) {
    if (idx == 0) return 6277101735386680763835789423207666416102355444464034512895;
    if (idx == 1) return 6277101735386680763835789423207666416102355444464034512895;
    if (idx == 2) return 174224571863520493293247799005065324265471;
    return 0;
}

function p521Order(idx) {
    if (idx == 0) return 3133570737968399159149941801531582740948264652215508558857;
    if (idx == 1) return 6277101735386680763835789423207666415997549511785646626411;
    if (idx == 2) return 174224571863520493293247799005065324265471;
    return 0;
}

function p521B(idx) {
    if (idx == 0) return 547364582324812430900498488650507072717847880149989605120;
    if (idx == 1) return 3993151480006583852361617897876632566937582753001559200635;
    if (idx == 2) return 27761252374348087053496079951978920493294;
    return 0;
}

function p521Gx(idx) {
    if (idx == 0) return 6230911794048810750454670662968615820721315729100536921446;
    if (idx == 1) return 3834735315097300619111169120549300089768954518793907296552;
    if (idx == 2) return 67553433416133576764234965921763675190338;
    return 0;
}

function p521Gy(idx) {
    if (idx == 0) return 4838157641056181845075812314798656917725686779035438376528;
    if (idx == 1) return 3750521042365617579808765813230050320788616902244711016000;
    if (idx == 2) return 95355043777284240316132626621711851002841;
    return 0;
}

function p521FieldPrime64(idx) {
    if (idx == 0) return 18446744073709551615;
    if (idx == 1) return 18446744073709551615;
    if (idx == 2) return 18446744073709551615;
    if (idx == 3) return 18446744073709551615;
    if (idx == 4) return 18446744073709551615;
    if (idx == 5) return 18446744073709551615;
    if (idx == 6) return 18446744073709551615;
    if (idx == 7) return 18446744073709551615;
    if (idx == 8) return 511;
    return 0;
}

function p521Order64(idx) {
    if (idx == 0) return 13506215149420700681;
    if (idx == 1) return 4302566813442262958;
    if (idx == 2) return 9208736750959699408;
    if (idx == 3) return 5874531763869423211;
    if (idx == 4) return 18446744073709551610;
    if (idx == 5) return 18446744073709551615;
    if (idx == 6) return 18446744073709551615;
    if (idx == 7) return 18446744073709551615;
    if (idx == 8) return 511;
    return 0;
}

function p521OrderComplement64(idx) {
    if (idx == 0) return 4940528924288850935;
    if (idx == 1) return 14144177260267288657;
    if (idx == 2) return 9238007322749852207;
    if (idx == 3) return 12572212309840128404;
    if (idx == 4) return 5;
    if (idx == 5) return 0;
    if (idx == 6) return 0;
    if (idx == 7) return 0;
    if (idx == 8) return 0;
    return 0;
}

function p521B64(idx) {
    if (idx == 0) return 17241221745651760896;
    if (idx == 1) return 3851667882566759665;
    if (idx == 2) return 1608559935907544839;
    if (idx == 3) return 6204052985702421371;
    if (idx == 4) return 13309414057048082913;
    if (idx == 5) return 11734817516813489651;
    if (idx == 6) return 10563792850091589870;
    if (idx == 7) return 10754236788854528543;
    if (idx == 8) return 81;
    return 0;
}

function p521Gx64(idx) {
    if (idx == 0) return 17977945514697932134;
    if (idx == 1) return 3695401138005885595;
    if (idx == 2) return 18311004035940853982;
    if (idx == 3) return 11622487132578732328;
    if (idx == 4) return 17881735149126499770;
    if (idx == 5) return 11269274249489003809;
    if (idx == 6) return 11402774946092790850;
    if (idx == 7) return 9623636836853541325;
    if (idx == 8) return 198;
    return 0;
}

function p521Gy64(idx) {
    if (idx == 0) return 9853476271941576272;
    if (idx == 1) return 3836064706166178368;
    if (idx == 2) return 14218067438623065953;
    if (idx == 3) return 10947813747232876096;
    if (idx == 4) return 1706790690937005612;
    if (idx == 5) return 11021790744852251752;
    if (idx == 6) return 6668247425720589273;
    if (idx == 7) return 4118940400423256068;
    if (idx == 8) return 280;
    return 0;
}
