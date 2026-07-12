#include "fenrua/p521/field_element.hpp"

#include <array>
#include <cstddef>
#include <iostream>
#include <optional>
#include <span>
#include <string>
#include <string_view>

namespace {

using fenrua::p521::FieldElement;

std::optional<unsigned char> decode_nibble(char value) {
    if (value >= '0' && value <= '9') return static_cast<unsigned char>(value - '0');
    if (value >= 'a' && value <= 'f') return static_cast<unsigned char>(value - 'a' + 10);
    return std::nullopt;
}

std::optional<FieldElement::Bytes> decode_hex(std::string_view encoded) {
    if (encoded.size() != 2 + (FieldElement::kEncodedSize * 2) || encoded.substr(0, 2) != "0x") {
        return std::nullopt;
    }

    FieldElement::Bytes bytes{};
    for (std::size_t index = 0; index < bytes.size(); ++index) {
        const auto high = decode_nibble(encoded[2 + (index * 2)]);
        const auto low = decode_nibble(encoded[3 + (index * 2)]);
        if (!high || !low) return std::nullopt;
        bytes[index] = static_cast<std::byte>(static_cast<unsigned char>((*high << 4U) | *low));
    }
    return bytes;
}

std::string encode_hex(const FieldElement::Bytes& bytes) {
    static constexpr char alphabet[] = "0123456789abcdef";
    std::string encoded(2 + (bytes.size() * 2), '0');
    encoded[0] = '0';
    encoded[1] = 'x';
    for (std::size_t index = 0; index < bytes.size(); ++index) {
        const auto value = std::to_integer<unsigned char>(bytes[index]);
        encoded[2 + (index * 2)] = alphabet[value >> 4U];
        encoded[3 + (index * 2)] = alphabet[value & 0x0fU];
    }
    return encoded;
}

std::optional<FieldElement> parse_field(std::string_view encoded) {
    const auto bytes = decode_hex(encoded);
    if (!bytes) return std::nullopt;
    return FieldElement::from_bytes_be(std::span<const std::byte>(*bytes));
}

void print_rejected() {
    std::cout << "{\"accepted\":false,\"canonicalHex\":null}\n";
}

} // namespace

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "usage: pn521_probe canonicalize HEX | add HEX HEX | sub HEX HEX\n";
        return 2;
    }

    const std::string_view operation(argv[1]);
    if (operation == "canonicalize") {
        const auto value = parse_field(argv[2]);
        if (!value) {
            print_rejected();
            return 0;
        }
        std::cout << "{\"accepted\":true,\"canonicalHex\":\""
                  << encode_hex(value->to_bytes_be()) << "\"}\n";
        return 0;
    }

    if (argc != 4 || (operation != "add" && operation != "sub")) {
        std::cerr << "invalid operation or argument count\n";
        return 2;
    }

    const auto left = parse_field(argv[2]);
    const auto right = parse_field(argv[3]);
    if (!left || !right) {
        std::cout << "{\"accepted\":false,\"resultHex\":null}\n";
        return 0;
    }

    const auto result = operation == "add" ? fenrua::p521::add(*left, *right)
                                             : fenrua::p521::subtract(*left, *right);
    std::cout << "{\"accepted\":true,\"resultHex\":\""
              << encode_hex(result.to_bytes_be()) << "\"}\n";
    return 0;
}
