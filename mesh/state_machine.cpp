#include "fenrua/mesh/state_machine.hpp"

namespace fenrua::mesh {
namespace {

[[nodiscard]] bool requires_evidence(EventType event) noexcept {
    return event == EventType::sync_completed ||
           event == EventType::validation_accepted ||
           event == EventType::validation_rejected ||
           event == EventType::fault_observed;
}

} // namespace

Transition NodeStateMachine::apply(const Event& event) noexcept {
    ++processed_events_;
    const NodeState from = state_;

    if (requires_evidence(event.type) && !event.evidence_sha256.has_value()) {
        return Transition{processed_events_, event.type, event.evidence_sha256,
                          from, from, false, "event requires SHA-256 evidence"};
    }

    if (state_ == NodeState::stopped) {
        return Transition{processed_events_, event.type, event.evidence_sha256,
                          from, from, false, "node is stopped"};
    }

    NodeState next = state_;
    bool accepted = true;
    std::string_view reason = "transition accepted";

    if (event.type == EventType::shutdown) {
        next = NodeState::stopped;
    } else if (event.type == EventType::fault_observed) {
        next = NodeState::quarantined;
    } else {
        switch (state_) {
        case NodeState::created:
            if (event.type == EventType::start_sync) {
                next = NodeState::syncing;
            } else {
                accepted = false;
            }
            break;
        case NodeState::syncing:
            if (event.type == EventType::sync_completed) {
                next = NodeState::ready;
            } else {
                accepted = false;
            }
            break;
        case NodeState::ready:
            if (event.type == EventType::begin_validation) {
                next = NodeState::validating;
            } else {
                accepted = false;
            }
            break;
        case NodeState::validating:
            if (event.type == EventType::validation_accepted) {
                next = NodeState::ready;
            } else if (event.type == EventType::validation_rejected) {
                next = NodeState::quarantined;
            } else {
                accepted = false;
            }
            break;
        case NodeState::quarantined:
            if (event.type == EventType::reset) {
                next = NodeState::syncing;
            } else {
                accepted = false;
            }
            break;
        case NodeState::stopped:
            accepted = false;
            break;
        }
    }

    if (!accepted) {
        reason = "event is invalid for current state";
        next = from;
    } else {
        state_ = next;
    }

    return Transition{processed_events_, event.type, event.evidence_sha256,
                      from, next, accepted, reason};
}

std::string_view to_string(NodeState state) noexcept {
    switch (state) {
    case NodeState::created:
        return "created";
    case NodeState::syncing:
        return "syncing";
    case NodeState::ready:
        return "ready";
    case NodeState::validating:
        return "validating";
    case NodeState::quarantined:
        return "quarantined";
    case NodeState::stopped:
        return "stopped";
    }
    return "unknown";
}

std::string_view to_string(EventType event) noexcept {
    switch (event) {
    case EventType::start_sync:
        return "start_sync";
    case EventType::sync_completed:
        return "sync_completed";
    case EventType::begin_validation:
        return "begin_validation";
    case EventType::validation_accepted:
        return "validation_accepted";
    case EventType::validation_rejected:
        return "validation_rejected";
    case EventType::fault_observed:
        return "fault_observed";
    case EventType::reset:
        return "reset";
    case EventType::shutdown:
        return "shutdown";
    }
    return "unknown";
}

} // namespace fenrua::mesh
