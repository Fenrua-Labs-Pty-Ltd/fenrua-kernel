#pragma once

#include "fenrua/evidence/sha256_digest.hpp"

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace fenrua::kernel {

// Every status is a report from a selected research backend. In particular,
// "accepted" is not a claim that Fenrua provides audited cryptographic proof.
enum class ResearchStatus {
    produced,
    accepted,
    rejected,
    invalid_input,
    unavailable,
    backend_error,
};

[[nodiscard]] std::string_view to_string(ResearchStatus status) noexcept;
[[nodiscard]] bool is_success(ResearchStatus status) noexcept;

struct CircuitDescriptor final {
    std::string name;
    std::uint32_t revision{0};
    std::string constraint_system;

    [[nodiscard]] bool valid() const noexcept;
};

// The only public constructor hashes the exact canonical bytes, preventing a
// caller from pairing arbitrary content with an unrelated digest.
class EvidenceArtifact final {
public:
    [[nodiscard]] static std::optional<EvidenceArtifact>
    create(std::string media_type, std::vector<std::byte> canonical_bytes);

    [[nodiscard]] const std::string& media_type() const noexcept { return media_type_; }
    [[nodiscard]] const std::vector<std::byte>& canonical_bytes() const noexcept {
        return canonical_bytes_;
    }
    [[nodiscard]] const evidence::Sha256Digest& sha256() const noexcept { return sha256_; }
    [[nodiscard]] bool valid() const noexcept;

private:
    EvidenceArtifact(
        std::string media_type,
        std::vector<std::byte> canonical_bytes,
        evidence::Sha256Digest sha256) noexcept;

    std::string media_type_;
    std::vector<std::byte> canonical_bytes_;
    evidence::Sha256Digest sha256_;
};

struct WitnessRequest final {
    std::string case_id;
    CircuitDescriptor circuit;
    EvidenceArtifact public_inputs;
    std::optional<EvidenceArtifact> private_inputs;
};

struct WitnessReport final {
    ResearchStatus status{ResearchStatus::unavailable};
    std::string backend_name;
    std::string backend_version;
    std::optional<EvidenceArtifact> witness;
    std::vector<std::string> observations;
};

class WitnessGenerator {
public:
    virtual ~WitnessGenerator() = default;

    [[nodiscard]] virtual WitnessReport
    generate(const WitnessRequest& request) const = 0;
};

struct ProofRequest final {
    std::string case_id;
    CircuitDescriptor circuit;
    EvidenceArtifact public_inputs;
    EvidenceArtifact witness;
};

struct ProofReport final {
    ResearchStatus status{ResearchStatus::unavailable};
    std::string backend_name;
    std::string backend_version;
    std::optional<EvidenceArtifact> proof;
    std::vector<std::string> observations;
};

struct VerificationRequest final {
    std::string case_id;
    CircuitDescriptor circuit;
    EvidenceArtifact public_inputs;
    EvidenceArtifact proof;
};

struct VerificationReport final {
    ResearchStatus status{ResearchStatus::unavailable};
    std::string backend_name;
    std::string backend_version;
    std::vector<std::string> observations;
};

// Interface only: concrete proving systems live behind an explicitly named
// backend so reports remain attributable and reproducible.
class ProofBackend {
public:
    virtual ~ProofBackend() = default;

    [[nodiscard]] virtual ProofReport prove(const ProofRequest& request) const = 0;
    [[nodiscard]] virtual VerificationReport
    verify(const VerificationRequest& request) const = 0;
};

} // namespace fenrua::kernel
