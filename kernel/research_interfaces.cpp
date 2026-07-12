#include "fenrua/kernel/research_interfaces.hpp"

#include <utility>

namespace fenrua::kernel {

std::string_view to_string(ResearchStatus status) noexcept {
    switch (status) {
    case ResearchStatus::produced:
        return "produced";
    case ResearchStatus::accepted:
        return "accepted";
    case ResearchStatus::rejected:
        return "rejected";
    case ResearchStatus::invalid_input:
        return "invalid_input";
    case ResearchStatus::unavailable:
        return "unavailable";
    case ResearchStatus::backend_error:
        return "backend_error";
    }
    return "unknown";
}

bool is_success(ResearchStatus status) noexcept {
    return status == ResearchStatus::produced || status == ResearchStatus::accepted;
}

bool CircuitDescriptor::valid() const noexcept {
    return !name.empty() && revision != 0 && !constraint_system.empty();
}

EvidenceArtifact::EvidenceArtifact(
    std::string media_type,
    std::vector<std::byte> canonical_bytes,
    evidence::Sha256Digest sha256) noexcept
    : media_type_(std::move(media_type)),
      canonical_bytes_(std::move(canonical_bytes)),
      sha256_(sha256) {}

std::optional<EvidenceArtifact>
EvidenceArtifact::create(
    std::string media_type,
    std::vector<std::byte> canonical_bytes) {
    if (media_type.empty()) {
        return std::nullopt;
    }
    const auto digest = evidence::compute_sha256(canonical_bytes);
    if (!digest.has_value()) {
        return std::nullopt;
    }
    return EvidenceArtifact(
        std::move(media_type), std::move(canonical_bytes), *digest);
}

bool EvidenceArtifact::valid() const noexcept {
    const auto digest = evidence::compute_sha256(canonical_bytes_);
    return !media_type_.empty() && digest.has_value() && *digest == sha256_;
}

} // namespace fenrua::kernel
