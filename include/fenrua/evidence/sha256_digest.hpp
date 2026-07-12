#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <span>
#include <string>
#include <string_view>

namespace fenrua::evidence {

// A strongly typed SHA-256 value. This type parses and serializes digest bytes;
// it intentionally does not implement hashing or certify how a digest was made.
class Sha256Digest final {
public:
    static constexpr std::size_t kSize = 32;
    static constexpr std::size_t kHexSize = kSize * 2;
    using Bytes = std::array<std::byte, kSize>;

    static std::optional<Sha256Digest> from_hex(std::string_view hex) noexcept;
    static constexpr Sha256Digest from_bytes(const Bytes& bytes) noexcept {
        return Sha256Digest(bytes);
    }

    [[nodiscard]] constexpr const Bytes& bytes() const noexcept { return bytes_; }
    [[nodiscard]] std::string hex() const;

    friend constexpr bool operator==(const Sha256Digest&, const Sha256Digest&) noexcept = default;

private:
    explicit constexpr Sha256Digest(const Bytes& bytes) noexcept : bytes_(bytes) {}

    Bytes bytes_{};
};

// Computes SHA-256 through the linked OpenSSL cryptographic provider. The
// optional is empty only when the provider cannot supply SHA-256.
[[nodiscard]] std::optional<Sha256Digest>
compute_sha256(std::span<const std::byte> bytes) noexcept;

} // namespace fenrua::evidence
