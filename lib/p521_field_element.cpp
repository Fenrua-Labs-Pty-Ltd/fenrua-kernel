#include "fenrua/p521/field_element.hpp"

#include <algorithm>

namespace fenrua::p521 {
namespace {

constexpr FieldElement::Limbs kModulus{
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    UINT64_MAX,
    FieldElement::kTopLimbMask,
};

[[nodiscard]] std::uint64_t add_limb(
    std::uint64_t left,
    std::uint64_t right,
    std::uint64_t& carry) noexcept {
    const std::uint64_t first = left + right;
    const std::uint64_t first_carry = static_cast<std::uint64_t>(first < left);
    const std::uint64_t result = first + carry;
    const std::uint64_t second_carry = static_cast<std::uint64_t>(result < first);
    carry = first_carry | second_carry;
    return result;
}

[[nodiscard]] std::uint64_t subtract_limb(
    std::uint64_t left,
    std::uint64_t right,
    std::uint64_t& borrow) noexcept {
    const std::uint64_t first = left - right;
    const std::uint64_t first_borrow = static_cast<std::uint64_t>(left < right);
    const std::uint64_t result = first - borrow;
    const std::uint64_t second_borrow = static_cast<std::uint64_t>(first < borrow);
    borrow = first_borrow | second_borrow;
    return result;
}

[[nodiscard]] bool limbs_less_than(
    const FieldElement::Limbs& left,
    const FieldElement::Limbs& right) noexcept {
    for (std::size_t index = FieldElement::kLimbCount; index-- > 0;) {
        if (left[index] != right[index]) {
            return left[index] < right[index];
        }
    }
    return false;
}

[[nodiscard]] FieldElement::Limbs subtract_limbs(
    const FieldElement::Limbs& left,
    const FieldElement::Limbs& right) noexcept {
    FieldElement::Limbs result{};
    std::uint64_t borrow = 0;
    for (std::size_t index = 0; index < result.size(); ++index) {
        result[index] = subtract_limb(left[index], right[index], borrow);
    }
    return result;
}

void fold_mersenne_carry(FieldElement::Limbs& limbs) noexcept {
    while ((limbs.back() >> 9U) != 0) {
        const std::uint64_t carry_from_bit_521 = limbs.back() >> 9U;
        limbs.back() &= FieldElement::kTopLimbMask;

        std::uint64_t carry = carry_from_bit_521;
        for (std::size_t index = 0; index < limbs.size() && carry != 0; ++index) {
            const std::uint64_t previous = limbs[index];
            limbs[index] += carry;
            carry = static_cast<std::uint64_t>(limbs[index] < previous);
        }
    }

    if (limbs == kModulus) {
        limbs.fill(0);
    }
}

} // namespace

bool are_canonical_limbs(const FieldElement::Limbs& limbs) noexcept {
    return (limbs.back() & ~FieldElement::kTopLimbMask) == 0 && limbs != kModulus;
}

std::optional<FieldElement>
FieldElement::from_canonical_limbs(const Limbs& limbs) noexcept {
    if (!are_canonical_limbs(limbs)) {
        return std::nullopt;
    }
    return FieldElement(limbs);
}

std::optional<FieldElement>
FieldElement::from_bytes_be(std::span<const std::byte> bytes) noexcept {
    if (bytes.size() != kEncodedSize) {
        return std::nullopt;
    }

    Limbs limbs{};
    for (std::size_t offset = 0; offset < bytes.size(); ++offset) {
        const std::size_t source_index = bytes.size() - 1 - offset;
        const std::size_t limb_index = offset / 8;
        const std::size_t bit_offset = (offset % 8) * 8;
        const auto value = std::to_integer<std::uint64_t>(bytes[source_index]);
        limbs[limb_index] |= value << bit_offset;
    }

    return from_canonical_limbs(limbs);
}

FieldElement::Bytes FieldElement::to_bytes_be() const noexcept {
    Bytes bytes{};
    for (std::size_t offset = 0; offset < bytes.size(); ++offset) {
        const std::size_t destination_index = bytes.size() - 1 - offset;
        const std::size_t limb_index = offset / 8;
        const std::size_t bit_offset = (offset % 8) * 8;
        const std::uint64_t value = (limbs_[limb_index] >> bit_offset) & UINT64_C(0xff);
        bytes[destination_index] = static_cast<std::byte>(value);
    }
    return bytes;
}

bool FieldElement::is_zero() const noexcept {
    return std::all_of(limbs_.begin(), limbs_.end(), [](std::uint64_t limb) {
        return limb == 0;
    });
}

FieldElement add(const FieldElement& left, const FieldElement& right) noexcept {
    FieldElement::Limbs result{};
    std::uint64_t carry = 0;
    for (std::size_t index = 0; index < result.size(); ++index) {
        result[index] = add_limb(left.limbs()[index], right.limbs()[index], carry);
    }

    fold_mersenne_carry(result);
    return *FieldElement::from_canonical_limbs(result);
}

FieldElement subtract(const FieldElement& left, const FieldElement& right) noexcept {
    FieldElement::Limbs result{};
    if (!limbs_less_than(left.limbs(), right.limbs())) {
        result = subtract_limbs(left.limbs(), right.limbs());
    } else {
        const auto difference = subtract_limbs(right.limbs(), left.limbs());
        result = subtract_limbs(kModulus, difference);
    }

    return *FieldElement::from_canonical_limbs(result);
}

FieldElement negate(const FieldElement& value) noexcept {
    if (value.is_zero()) {
        return FieldElement::zero();
    }

    const auto result = subtract_limbs(kModulus, value.limbs());
    return *FieldElement::from_canonical_limbs(result);
}

} // namespace fenrua::p521
