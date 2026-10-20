#include "../include/pyromat_can_trace.h"
#include <cassert>
#include <cstdint>
#include <cstdio>

int main() {
  pyromat::CanTrace trace;
  const uint8_t data[] = {0x8d,0,0x7f,0,70,0,0xcd,1};
  trace.capture(0x23b, data, 8, false, false, 110);
  assert(!trace.snapshot(0).running);
  assert(trace.snapshot(0).frames.empty());
  trace.start();
  trace.capture(0x23b, data, 8, false, false, 120);
  auto first = trace.snapshot(0);
  assert(first.running && first.generation == 1 && first.last_sequence == 1);
  assert(first.frames.size() == 1 && first.frames[0].can_id == 0x23b);
  assert(first.frames[0].length == 8 && first.frames[0].data[4] == 70);
  assert(!first.frames[0].extended && !first.frames[0].rtr);
  trace.capture(0x1fffffff, nullptr, 0, true, true, 130);
  assert(trace.snapshot(1).frames[0].extended);
  trace.capture(0x7ff, data, 9, false, false, 140);
  assert(trace.snapshot(1).last_sequence == 2);
  trace.stop();
  trace.capture(0x77, data, 8, false, false, 150);
  assert(trace.snapshot(2).frames.empty());
  trace.start();
  assert(trace.snapshot(0).frames.empty() && trace.snapshot(0).generation == 2);
  for (uint32_t i=0; i<520; ++i) trace.capture(0x23b, data, 8, false, false, i);
  auto after = trace.snapshot(0, 32);
  assert(after.frames.size() == 32);
  assert(after.frames[0].sequence == 9 && after.frames[31].sequence == 40);
  assert(after.overwritten == 8 && after.missed == 8);
  auto page = trace.snapshot(500, 96);
  assert(page.frames.size() == 20 && page.frames[0].sequence == 501 && page.missed == 0);
  trace.clear();
  auto empty = trace.snapshot(0);
  assert(empty.running && empty.frames.empty() && empty.generation == 3);
  assert(empty.last_sequence == 0 && empty.overwritten == 0);
  std::puts("can trace tests passed");
}
