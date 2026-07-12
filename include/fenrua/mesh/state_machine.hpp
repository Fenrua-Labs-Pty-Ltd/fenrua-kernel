#pragma once

#include "fenrua/evidence/sha256_digest.hpp"

#include <cstdint>
#include <optional>
#include <string_view>

namespace fenrua::mesh {

enum class NodeState {
    created,
    syncing,
    ready,
    validating,
    quarantined,
    stopped,
};

enum class EventType {
    start_sync,
    sync_completed,
    begin_validation,
    validation_accepted,
    validation_rejected,
    fault_observed,
    reset,
    shutdown,
};

struct Event final {
    EventType type{EventType::shutdown};
    std::optional<evidence::Sha256Digest> evidence_sha256;
};

struct Transition final {
    std::uint64_t sequence{0};
    EventType event{EventType::shutdown};
    std::optional<evidence::Sha256Digest> evidence_sha256;
    NodeState from{NodeState::created};
    NodeState to{NodeState::created};
    bool accepted{false};
    std::string_view reason;
};

// A deterministic local state reducer. It performs no network I/O and stores
// no peer data. Callers are responsible for persisting returned transitions.
class NodeStateMachine final {
public:
    [[nodiscard]] constexpr NodeState state() const noexcept { return state_; }
    [[nodiscard]] constexpr std::uint64_t processed_events() const noexcept {
        return processed_events_;
    }

    // Validation decisions, completed syncs, and observed faults require a
    // SHA-256 evidence value. The returned transition retains both the event
    // and digest so a persisted audit record cannot lose its causal evidence.
    // Rejected events still consume a sequence number so an event stream can
    // be audited without ambiguous numbering.
    [[nodiscard]] Transition apply(const Event& event) noexcept;

private:
    NodeState state_{NodeState::created};
    std::uint64_t processed_events_{0};
};

[[nodiscard]] std::string_view to_string(NodeState state) noexcept;
[[nodiscard]] std::string_view to_string(EventType event) noexcept;

} // namespace fenrua::mesh
