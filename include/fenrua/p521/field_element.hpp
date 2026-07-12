#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>

namespace fenrua::p521 {

// An element of the field defined by p = 2^521 - 1, stored as nine
// little-endian 64-bit limbs. Instances are always in [0, p).
//
// These deterministic value operations are a foundation for research code.
// They have not been audited and do not make a constant-time guarantee.
class FieldElement final {
public:
    static constexpr std::size_t kLimbCount = 9;
    static constexpr std::size_t kEncodedSize = 66;
    static constexpr std::uint64_t kTopLimbMask = UINT64_C(0x1ff);

    using Limbs = std::array<std::uint64_t, kLimbCount>;
    using Bytes = std::array<std::byte, kEncodedSize>;

    [[nodiscard]] static constexpr FieldElement zero() noexcept {
        return FieldElement(Limbs{});
    }

    [[nodiscard]] static constexpr FieldElement one() noexcept {
        Limbs limbs{};
        limbs[0] = 1;
        return FieldElement(limbs);
    }

    [[nodiscard]] static std::optional<FieldElement>
    from_canonical_limbs(const Limbs& limbs) noexcept;

    // Parses a fixed-width, unsigned, big-endian encoding. Values equal to or
    // greater than p and encodings of any other length are rejected.
    [[nodiscard]] static std::optional<FieldElement>
    from_bytes_be(std::span<const std::byte> bytes) noexcept;

    [[nodiscard]] constexpr const Limbs& limbs() const noexcept { return limbs_; }
    [[nodiscard]] Bytes to_bytes_be() const noexcept;
    [[nodiscard]] bool is_zero() const noexcept;

    friend constexpr bool operator==(const FieldElement&, const FieldElement&) noexcept = default;

private:
    explicit constexpr FieldElement(const Limbs& limbs) noexcept : limbs_(limbs) {}

    Limbs limbs_{};
};

[[nodiscard]] bool are_canonical_limbs(const FieldElement::Limbs& limbs) noexcept;

[[nodiscard]] FieldElement add(const FieldElement& left, const FieldElement& right) noexcept;
[[nodiscard]] FieldElement subtract(const FieldElement& left, const FieldElement& right) noexcept;
[[nodiscard]] FieldElement negate(const FieldElement& value) noexcept;

} // namespace fenrua::p521
