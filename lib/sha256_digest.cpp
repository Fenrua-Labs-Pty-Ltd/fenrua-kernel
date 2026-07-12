#include "fenrua/evidence/sha256_digest.hpp"

#include <cstdint>
#include <openssl/evp.h>

namespace fenrua::evidence {
namespace {

[[nodiscard]] constexpr std::optional<std::uint8_t> decode_nibble(char value) noexcept {
    if (value >= '0' && value <= '9') {
        return static_cast<std::uint8_t>(value - '0');
    }
    if (value >= 'a' && value <= 'f') {
        return static_cast<std::uint8_t>(value - 'a' + 10);
    }
    return std::nullopt;
}

} // namespace

std::optional<Sha256Digest> Sha256Digest::from_hex(std::string_view hex) noexcept {
    if (hex.size() != kHexSize) {
        return std::nullopt;
    }

    Bytes bytes{};
    for (std::size_t index = 0; index < bytes.size(); ++index) {
        const auto high = decode_nibble(hex[index * 2]);
        const auto low = decode_nibble(hex[(index * 2) + 1]);
        if (!high.has_value() || !low.has_value()) {
            return std::nullopt;
        }

        const auto value = static_cast<std::uint8_t>(
            static_cast<std::uint8_t>(*high << 4U) | *low);
        bytes[index] = static_cast<std::byte>(value);
    }

    return Sha256Digest(bytes);
}

std::string Sha256Digest::hex() const {
    static constexpr char kHexAlphabet[] = "0123456789abcdef";

    std::string result(kHexSize, '0');
    for (std::size_t index = 0; index < bytes_.size(); ++index) {
        const auto value = std::to_integer<std::uint8_t>(bytes_[index]);
        result[index * 2] = kHexAlphabet[value >> 4U];
        result[(index * 2) + 1] = kHexAlphabet[value & UINT8_C(0x0f)];
    }
    return result;
}

std::optional<Sha256Digest>
compute_sha256(std::span<const std::byte> bytes) noexcept {
    Sha256Digest::Bytes digest{};
    std::size_t digest_size = 0;
    const auto* data = reinterpret_cast<const unsigned char*>(bytes.data());
    if (EVP_Q_digest(
            nullptr,
            "SHA256",
            nullptr,
            data,
            bytes.size(),
            reinterpret_cast<unsigned char*>(digest.data()),
            &digest_size) != 1 ||
        digest_size != digest.size()) {
        return std::nullopt;
    }
    return Sha256Digest::from_bytes(digest);
}

} // namespace fenrua::evidence
