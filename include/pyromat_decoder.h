#pragma once
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <string>
namespace pyromat {
enum class Field { BOILER, EXHAUST, FAN, RETURN_TEMP, BUFFER_TOP, BUFFER_MIDDLE, BUFFER_BOTTOM,
  BOILER_TARGET, SYSTEM, O2, O2_TARGET_CANDIDATE, PRIMARY_AIR, SECONDARY_AIR, RETURN_VALVE_RAW,
  BUFFER_VALVE_RAW, HEATING_SUPPLY, UNKNOWN_117_1, UNKNOWN_117_2, STATE_RAW,
  YEAR, MONTH, DAY, WEEKDAY, HOUR, MINUTE, SECOND };
struct Value { Field field; float value; };
struct Decoded { Value values[3]{}; std::size_t size{0}; bool valid_frame{false}; };
inline Decoded decode(uint32_t can_id, const uint8_t *data, std::size_t length) {
  Decoded result;
  if (data == nullptr || length != 8 ||
      (can_id != 0x23B && can_id != 0x33B && can_id != 0x43B && can_id != 0x53B)) return result;
  result.valid_frame = true;
  const auto word = [data](unsigned pos) -> uint16_t {
    return static_cast<uint16_t>(data[pos] | (static_cast<uint16_t>(data[pos + 1]) << 8));
  };
  const uint16_t index = word(0), a = word(2), b = word(4), c = word(6);
  const auto add = [&result](Field field, uint16_t raw, float scale, float low, float high) {
    const float value = raw * scale;
    if (value >= low && value <= high && result.size < 3) result.values[result.size++] = {field, value};
  };
  const auto temperature = [&add](Field field, uint16_t raw) { add(field, raw, 0.1f, 0, 150); };
  const auto raw = [&add](Field field, uint16_t value) { add(field, value, 1, 0, 65535); };
  switch (index) {
    case 0x0012: raw(Field::STATE_RAW, a); break;
    case 0x001E: add(Field::O2, c, 0.1f, 0, 25); break;
    case 0x0027: temperature(Field::BUFFER_BOTTOM, a); break;
    case 0x003F:
      add(Field::YEAR, a, 1, 2000, 2199); add(Field::MONTH, b, 1, 1, 12); add(Field::DAY, c, 1, 1, 31); break;
    case 0x0042:
      add(Field::WEEKDAY, a, 1, 1, 7); add(Field::MINUTE, b, 1, 0, 59); add(Field::SECOND, c, 1, 0, 59); break;
    case 0x0045: add(Field::HOUR, a, 1, 0, 23); break;
    case 0x0054: temperature(Field::SYSTEM, a); break;
    case 0x0066: add(Field::EXHAUST, a, 0.1f, 0, 600); add(Field::FAN, c, 1, 0, 20000); break;
    case 0x007B: raw(Field::RETURN_VALVE_RAW, c); break;
    case 0x007E: raw(Field::BUFFER_VALVE_RAW, b); break;
    case 0x0087: add(Field::PRIMARY_AIR, b, 1, 0, 100); break;
    case 0x008D:
      add(Field::O2_TARGET_CANDIDATE, b, 0.1f, 0, 25); temperature(Field::RETURN_TEMP, c); break;
    case 0x0090: add(Field::SECONDARY_AIR, c, 1, 0, 100); break;
    case 0x0096: temperature(Field::BUFFER_MIDDLE, a); temperature(Field::BUFFER_TOP, b); break;
    case 0x009C: temperature(Field::BOILER, c); break;
    case 0x009F: temperature(Field::BOILER_TARGET, a); break;
    case 0x0117:
      raw(Field::UNKNOWN_117_1, a); raw(Field::UNKNOWN_117_2, b); temperature(Field::HEATING_SUPPLY, c); break;
    default: break;
  }
  return result;
}

// The boiler's own clock is shown as received; this never changes its settings.
class Clock {
 public:
  void update(Field field, float value, uint32_t now) {
    const int number = static_cast<int>(value);
    switch (field) {
      case Field::YEAR: year_=number; seen_ |= 1; year_at_=now; break;
      case Field::MONTH: month_=number; seen_ |= 2; month_at_=now; break;
      case Field::DAY: day_=number; seen_ |= 4; day_at_=now; break;
      case Field::HOUR: hour_=number; seen_ |= 8; hour_at_=now; break;
      case Field::MINUTE: minute_=number; seen_ |= 16; minute_at_=now; break;
      case Field::SECOND: second_=number; seen_ |= 32; second_at_=now; break;
      case Field::WEEKDAY: weekday_=number; seen_ |= 64; weekday_at_=now; break;
      default: break;
    }
  }
  std::string time(uint32_t now) const {
    if ((seen_ & 56) != 56 || !fresh(now, hour_at_) || !fresh(now, minute_at_) || !fresh(now, second_at_)) return {};
    char text[12]; std::snprintf(text, sizeof(text), "%02d:%02d:%02d", hour_, minute_, second_); return text;
  }
  std::string date(uint32_t now) const {
    if ((seen_ & 7) != 7 || !fresh(now, year_at_) || !fresh(now, month_at_) || !fresh(now, day_at_) || month_ < 1 || month_ > 12) return {};
    const int days[]{31,28,31,30,31,30,31,31,30,31,30,31};
    const bool leap = year_%4 == 0 && (year_%100 != 0 || year_%400 == 0);
    const int limit = days[month_-1] + ((month_ == 2 && leap) ? 1 : 0);
    if (day_ < 1 || day_ > limit) return {};
    char text[16]; std::snprintf(text, sizeof(text), "%02d.%02d.%04d", day_, month_, year_); return text;
  }
  std::string weekday(uint32_t now) const {
    if (!(seen_ & 64) || !fresh(now, weekday_at_) || weekday_<1 || weekday_>7) return "Keine Daten";
    const char *names[]{"Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"};
    return names[weekday_-1];
  }
 private:
  static bool fresh(uint32_t now, uint32_t at) { return static_cast<uint32_t>(now-at) <= 60000; }
  int year_{0}, month_{0}, day_{0}, hour_{0}, minute_{0}, second_{0}, weekday_{0};
  uint8_t seen_{0};
  uint32_t year_at_{0}, month_at_{0}, day_at_{0}, hour_at_{0}, minute_at_{0}, second_at_{0}, weekday_at_{0};
};
}
