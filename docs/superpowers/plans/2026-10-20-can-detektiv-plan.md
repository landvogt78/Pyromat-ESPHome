# CAN-Detektiv Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Add a permanently available read-only CAN trace and a strictly dry-run transmission preview to Pyromat-ESPHome, with the operator-confirmed O₂ target and boiler time correctly labeled.

**Architecture:** Fixed-size, mutex-protected ring buffer receives CAN frames (no outbound frames). A digest-authenticated GET-only HTTP handler returns bounded JSON batches to a new dashboard tab. Existing decoder and ESPHome API/MQTT remain unaffected. GUI validates packets and provides filtering, changed-byte highlights, reference marks, CSV exports and entirely browser-local write previews.

**Tech Stack:** ESPHome 2026.9.1, ESP-IDF, C++17, MCP2515, vanilla JavaScript, Node 22.

**Spec:** docs/superpowers/specs/2026-10-20-can-detektiv-design.md

## Global Constraints
- No `canbus.send`, transmit action, writable CAN handler, external socket or remote write.
- Standard CAN is 125 kbit/s; existing four IDs and decoder remain.
- Authentication of any new HTTP handler through `web_server_base::add_handler()` only.
- Capture OFF on power-up; fixed-size RAM ring, no flash logging.
- No additional software dependencies; no cloud assets or stored credentials.
- Treat O₂ setpoint (`0x008D` W2) and boiler *time* as operator-confirmed; raw values at `0x007B` W3 and `0x007E` W2 are unverified.

## Review Focus
- Empty or malformed and >8-byte frames: truncated safely or ignored; never overflow.
- Multiple clients and slow polling: cursor-based pagination and an explicit lost-range signal.
- Capture restart: generation changes; stale browser cursor resets correctly.
- Simulated write fields: IDs outside 0–0x7FF and non-hex/odd byte sequences rejected.
- Hidden tab or disconnected browser: no continuous expensive polling and no transmission.

---

### Task 1: Buffer and serialization contract
**Files:** Create `include/pyromat_can_trace.h`, `tests/can_trace_test.cpp`.
**Interfaces:** `pyromat::CanTrace::start/stop/clear/capture/snapshot`, `pyromat::trace()`.
- [ ] Write failing tests for default off, capture, overwrite, pagination, generation.
- [ ] Run C++17 test to verify failure.
- [ ] Implement fixed 512-record ring with mutex and bounded batches.
- [ ] Run C++17 tests and commit.

### Task 2: Protected HTTP trace and CAN integration
**Files:** Create `include/pyromat_trace_web.h`; modify `packages/bridge.yaml`.
**Interfaces:** `GET /can/trace?after=SEQ` -> `{running,generation,last_sequence,overwritten,missed,frames:[]}`; `POST /button/CAN%20Aufzeichnung%20starten/press`, stop, clear.
- [ ] Test frame snapshots and batch edge cases.
- [ ] Add `AsyncWebHandler` under the existing digest-authenticated server; reject non-GET.
- [ ] Register in on_boot, add masked receive triggers for Standard and Extended; leave four decoder triggers.
- [ ] Add ESPHome buttons for trace start/stop/clear; no CAN TX code.
- [ ] Check YAML structure and commit.

### Task 3: Browser trace and dry-run preview
**Files:** Create `web/can-detektiv.js`, `tests/can-detektiv.test.cjs`; modify `web/dashboard.js`, `web/dashboard.css`.
**Interfaces:** `window.PyromatCanDetektiv.init(options)`, pure parsers `parseFrame,parseDryRunFrame` exported for tests.
- [ ] Add failing Node tests for validation, delta comparisons, CSV escaping and dry-run rejection.
- [ ] Implement trace polling, filters, changed-byte flags, pause/reference/CSV.
- [ ] Add fourth tab to existing dashboard, no new client libraries.
- [ ] Register separate JS module embedded in existing dashboard bundle; test browser preview.
- [ ] Run Node tests and commit.

### Task 4: Confirmed values and documentation
**Files:** Modify `packages/entities.yaml`, `web/dashboard.js`, `docs/protokoll.md`, `README.md`.
- [ ] Replace O₂ candidate label with confirmed O₂ setpoint while preserving internal IDs.
- [ ] Keep boiler time; avoid falsely describing boiler *date* as explicitly confirmed.
- [ ] Relabel dubious valve fields with neutral register names, leave diagnostic only.
- [ ] Document trace limits, HTTP authentication, dry-run-only write test, testing procedure.
- [ ] Run repository tests without manually compiling firmware, inspect CI, commit.
