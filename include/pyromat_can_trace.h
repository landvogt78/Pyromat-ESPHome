#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#ifdef USE_ESP32
#include "esphome/core/helpers.h"
#else
#include <mutex>
#endif
#include <vector>

namespace pyromat {
#ifdef USE_ESP32
using TraceMutex = esphome::Mutex;
using TraceLock = esphome::LockGuard;
#else
using TraceMutex = std::mutex;
using TraceLock = std::lock_guard<std::mutex>;
#endif

struct TraceFrame {
  uint32_t sequence{0};
  uint32_t uptime_ms{0};
  uint32_t can_id{0};
  uint8_t length{0};
  bool extended{false};
  bool rtr{false};
  std::array<uint8_t, 8> data{};
};

struct TraceSnapshot {
  bool running{false};
  uint32_t generation{0};
  uint32_t last_sequence{0};
  uint32_t overwritten{0};
  uint32_t missed{0};
  size_t buffered{0};
  size_t capacity{0};
  std::vector<TraceFrame> frames{};
};

// Fixed-size RAM capture; read-only CAN traffic, no CAN transmit method.
class CanTrace {
 public:
  static constexpr size_t CAPACITY = 2048;
  void start() {
    TraceLock lock(mutex_);
    reset_();
    ++generation_;
    running_ = true;
  }
  void stop() {
    TraceLock lock(mutex_);
    running_ = false;
  }
  void clear() {
    TraceLock lock(mutex_);
    reset_();
    ++generation_;
  }
  void capture(uint32_t can_id, const uint8_t *payload, size_t length, bool extended, bool rtr, uint32_t uptime_ms) {
    if (length > 8 || (length && payload == nullptr)) return;
    TraceLock lock(mutex_);
    if (!running_) return;
    if (size_ == CAPACITY) {
      head_ = (head_ + 1) % CAPACITY;
      ++overwritten_;
    } else {
      ++size_;
    }
    auto &frame = frames_[(head_ + size_ - 1) % CAPACITY];
    frame = {};
    frame.sequence = ++last_sequence_;
    frame.uptime_ms = uptime_ms;
    frame.can_id = can_id;
    frame.length = static_cast<uint8_t>(length);
    frame.extended = extended;
    frame.rtr = rtr;
    for (size_t i = 0; i < length; ++i) frame.data[i] = payload[i];
  }
  TraceSnapshot snapshot(uint32_t after, size_t limit = 96) const {
    TraceLock lock(mutex_);
    TraceSnapshot out;
    out.running = running_;
    out.generation = generation_;
    out.last_sequence = last_sequence_;
    out.overwritten = overwritten_;
    out.buffered = size_;
    out.capacity = CAPACITY;
    if (size_ == 0 || limit == 0) return out;
    const uint32_t first_sequence = frames_[head_].sequence;
    const uint32_t minimum_after = first_sequence - 1;
    if (after < minimum_after) out.missed = minimum_after - after;
    out.frames.reserve(std::min(limit, size_));
    for (size_t i = 0; i < size_ && out.frames.size() < limit; ++i) {
      const auto &frame = frames_[(head_ + i) % CAPACITY];
      if (frame.sequence > after) out.frames.push_back(frame);
    }
    return out;
  }
 private:
  void reset_() {
    head_ = 0;
    size_ = 0;
    last_sequence_ = 0;
    overwritten_ = 0;
  }
  mutable TraceMutex mutex_;
  std::array<TraceFrame, CAPACITY> frames_{};
  size_t head_{0};
  size_t size_{0};
  bool running_{false};
  uint32_t generation_{0};
  uint32_t last_sequence_{0};
  uint32_t overwritten_{0};
};

// A single process-wide trace, shared by the ESPHome frame hooks and HTTP handler.
inline CanTrace &trace() {
  static CanTrace instance;
  return instance;
}
} // namespace pyromat
