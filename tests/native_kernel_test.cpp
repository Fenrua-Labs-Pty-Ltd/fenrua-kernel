#include "fenrua/evidence/sha256_digest.hpp"
#include "fenrua/kernel/research_interfaces.hpp"
#include "fenrua/mesh/state_machine.hpp"
#include "fenrua/p521/field_element.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <span>
#include <string_view>
#include <vector>

namespace {

using fenrua::p521::FieldElement;

bool expect(bool condition, std::string_view label) {
    if (!condition) {
        std::cerr << "FAIL " << label << '\n';
        return false;
    }
    std::cout << "PASS " << label << '\n';
    return true;
}

FieldElement::Limbs p_limbs() {
    FieldElement::Limbs limbs{};
    limbs.fill(UINT64_MAX);
    limbs.back() = FieldElement::kTopLimbMask;
    return limbs;
}

FieldElement::Limbs p_minus_one_limbs() {
    auto limbs = p_limbs();
    --limbs.front();
    return limbs;
}

} // namespace

int main() {
    bool ok = true;

    const auto p = p_limbs();
    const auto p_minus_one_value = FieldElement::from_canonical_limbs(p_minus_one_limbs());
    ok &= expect(!FieldElement::from_canonical_limbs(p).has_value(), "reject-field-modulus");

    auto high_bits = FieldElement::Limbs{};
    high_bits.back() = FieldElement::kTopLimbMask + 1U;
    ok &= expect(
        !FieldElement::from_canonical_limbs(high_bits).has_value(),
        "reject-noncanonical-high-bits");

    ok &= expect(p_minus_one_value.has_value(), "accept-p-minus-one");
    if (!p_minus_one_value.has_value()) {
        return 1;
    }

    ok &= expect(
        fenrua::p521::add(*p_minus_one_value, FieldElement::one()).is_zero(),
        "field-add-wrap");
    ok &= expect(
        fenrua::p521::subtract(FieldElement::zero(), FieldElement::one()) ==
            *p_minus_one_value,
        "field-subtract-underflow");
    ok &= expect(
        fenrua::p521::negate(FieldElement::one()) == *p_minus_one_value,
        "field-negate-one");

    const auto encoded = p_minus_one_value->to_bytes_be();
    ok &= expect(
        FieldElement::from_bytes_be(encoded) == p_minus_one_value,
        "field-encoding-roundtrip");
    ok &= expect(
        !FieldElement::from_bytes_be(
             std::span<const std::byte>(encoded.data(), encoded.size() - 1U))
             .has_value(),
        "reject-variable-width-encoding");

    constexpr std::string_view digest_hex =
        "000102030405060708090a0b0c0d0e0f"
        "101112131415161718191a1b1c1d1e1f";
    const auto digest = fenrua::evidence::Sha256Digest::from_hex(digest_hex);
    ok &= expect(digest.has_value() && digest->hex() == digest_hex, "sha256-value-roundtrip");
    ok &= expect(
        !fenrua::evidence::Sha256Digest::from_hex("not-a-digest").has_value(),
        "reject-invalid-sha256-value");
    ok &= expect(
        !fenrua::evidence::Sha256Digest::from_hex(
             "BA7816BF8F01CFEA414140DE5DAE2223"
             "B00361A396177A9CB410FF61F20015AD")
             .has_value(),
        "reject-uppercase-sha256-value");

    const std::vector<std::byte> abc{
        std::byte{'a'}, std::byte{'b'}, std::byte{'c'}};
    const auto abc_digest = fenrua::evidence::compute_sha256(abc);
    ok &= expect(
        abc_digest.has_value() &&
            abc_digest->hex() ==
                "ba7816bf8f01cfea414140de5dae2223"
                "b00361a396177a9cb410ff61f20015ad",
        "compute-sha256-known-vector");
    const auto artifact = fenrua::kernel::EvidenceArtifact::create(
        "application/json", abc);
    ok &= expect(artifact.has_value() && artifact->valid(), "evidence-artifact-binds-bytes");
    ok &= expect(
        !fenrua::kernel::EvidenceArtifact::create("", abc).has_value(),
        "evidence-artifact-rejects-empty-media-type");

    fenrua::mesh::NodeStateMachine mesh;
    ok &= expect(
        mesh.apply({fenrua::mesh::EventType::start_sync, std::nullopt}).accepted,
        "mesh-start-sync");
    ok &= expect(
        !mesh.apply({fenrua::mesh::EventType::sync_completed, std::nullopt}).accepted &&
            mesh.state() == fenrua::mesh::NodeState::syncing,
        "mesh-reject-missing-evidence");
    const auto sync_transition =
        mesh.apply({fenrua::mesh::EventType::sync_completed, digest});
    ok &= expect(
        sync_transition.accepted &&
            sync_transition.event == fenrua::mesh::EventType::sync_completed &&
            sync_transition.evidence_sha256 == digest &&
            mesh.state() == fenrua::mesh::NodeState::ready,
        "mesh-accept-evidenced-transition");

    auto second_digest_bytes = fenrua::evidence::Sha256Digest::Bytes{};
    second_digest_bytes.back() = std::byte{1};
    const auto second_digest =
        fenrua::evidence::Sha256Digest::from_bytes(second_digest_bytes);
    fenrua::mesh::NodeStateMachine first_fault_mesh;
    fenrua::mesh::NodeStateMachine second_fault_mesh;
    const auto first_fault = first_fault_mesh.apply(
        {fenrua::mesh::EventType::fault_observed, digest});
    const auto second_fault = second_fault_mesh.apply(
        {fenrua::mesh::EventType::fault_observed, second_digest});
    ok &= expect(
        first_fault.accepted && second_fault.accepted &&
            first_fault.event == fenrua::mesh::EventType::fault_observed &&
            second_fault.event == fenrua::mesh::EventType::fault_observed &&
            first_fault.evidence_sha256 != second_fault.evidence_sha256,
        "mesh-distinguishes-causal-evidence");
    ok &= expect(
        mesh.apply({fenrua::mesh::EventType::shutdown, std::nullopt}).accepted &&
            mesh.state() == fenrua::mesh::NodeState::stopped,
        "mesh-terminal-shutdown");

    return ok ? 0 : 1;
}
