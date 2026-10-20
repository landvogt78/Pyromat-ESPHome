#include "../include/pyromat_decoder.h"
#include <cassert>
#include <cmath>
#include <iostream>

float get(const pyromat::Decoded &d, pyromat::Field field) {
  for (std::size_t i=0;i<d.size;i++) if(d.values[i].field==field) return d.values[i].value;
  return NAN;
}
int main() {
  using pyromat::Field;
  const uint8_t boiler[]{0x9c,0,0,0,0,0,0xde,1};
  for (uint32_t id: {0x23bu,0x33bu,0x43bu,0x53bu}) {
    auto d=pyromat::decode(id,boiler,8);
    assert(d.valid_frame && std::fabs(get(d,Field::BOILER)-47.8f)<0.001f);
  }
  assert(!pyromat::decode(0x381,boiler,8).valid_frame);
  assert(!pyromat::decode(0x23b,boiler,7).valid_frame);
  const uint8_t wrong_page[]{0x9c,3,0,0,0,0,0xde,1};
  assert(std::isnan(get(pyromat::decode(0x23b,wrong_page,8),Field::BOILER)));
  const uint8_t invalid[]{0x9c,0,0,0,0,0,0,0x90};
  assert(std::isnan(get(pyromat::decode(0x23b,invalid,8),Field::BOILER)));
  const uint8_t date[]{0x3f,0,0xe8,7,10,0,30,0};
  auto d=pyromat::decode(0x53b,date,8);
  assert(get(d,Field::YEAR)==2024 && get(d,Field::MONTH)==10 && get(d,Field::DAY)==30);
  const uint8_t clock_packet[]{0x42,0,3,0,4,0,52,0};
  d=pyromat::decode(0x43b,clock_packet,8);
  assert(get(d,Field::WEEKDAY)==3 && get(d,Field::MINUTE)==4 && get(d,Field::SECOND)==52);
  const uint8_t hour[]{0x45,0,13,0,0,0,0,0};
  assert(get(pyromat::decode(0x33b,hour,8),Field::HOUR)==13);
  const uint8_t o2[]{0x8d,0,0x7f,0,70,0,0xcd,1};
  d=pyromat::decode(0x33b,o2,8);
  assert(get(d,Field::O2_TARGET_CANDIDATE)==7.0f);
  assert(std::fabs(get(d,Field::RETURN_TEMP)-46.1f)<0.001f);
  const uint8_t valve[]{0x7b,0,0,0,135,0,0x10,0xf5};
  assert(get(pyromat::decode(0x53b,valve,8),Field::RETURN_VALVE_RAW)==62736);
  const uint8_t heat[]{0x17,1,140,0,0xd4,3,0x7c,1};
  d=pyromat::decode(0x53b,heat,8);
  assert(get(d,Field::UNKNOWN_117_1)==140 && get(d,Field::UNKNOWN_117_2)==980);
  assert(get(d,Field::HEATING_SUPPLY)==38);
  pyromat::Clock clock;
  assert(clock.time(0).empty() && clock.date(0).empty());
  const auto apply = [&clock](const pyromat::Decoded &result, uint32_t now) {
    for (std::size_t i=0;i<result.size;i++) clock.update(result.values[i].field,result.values[i].value,now);
  };
  apply(pyromat::decode(0x53b,date,8), 1000);
  apply(pyromat::decode(0x23b,clock_packet,8), 1000);
  apply(pyromat::decode(0x33b,hour,8), 1000);
  assert(clock.date(1001)=="30.10.2024");
  assert(clock.time(1001)=="13:04:52");
  assert(clock.weekday(1001)=="Mittwoch");
  assert(clock.time(61001).empty());
  assert(clock.date(61001).empty());
  apply(pyromat::decode(0x23b,clock_packet,8), 62000);
  assert(clock.time(62000).empty()); // recent seconds cannot refresh a missing hour packet
  apply(pyromat::decode(0x33b,hour,8), 62000);
  assert(clock.time(62000)=="13:04:52");
  const uint8_t next_hour[]{0x45,0,14,0,0,0,0,0};
  const uint8_t next_minute[]{0x42,0,3,0,0,0,3,0};
  apply(pyromat::decode(0x23b,next_minute,8), 63000);
  apply(pyromat::decode(0x33b,next_hour,8), 63001);
  assert(clock.time(63002)=="14:00:03");
  const uint8_t invalid_year[]{0x3f,0,0xff,0xff,10,0,30,0};
  apply(pyromat::decode(0x53b,invalid_year,8), 64000);
  assert(clock.date(64000).empty()); // valid month/day cannot renew an expired year
  const uint8_t invalid_minute[]{0x42,0,3,0,0xff,0xff,3,0};
  apply(pyromat::decode(0x33b,next_hour,8), 124000);
  apply(pyromat::decode(0x23b,invalid_minute,8), 124000);
  assert(clock.time(124000).empty()); // seconds cannot renew an expired minute
  std::cout << "Decoder fixtures passed\n";
}
