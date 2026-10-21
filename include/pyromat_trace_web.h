#pragma once

#include "pyromat_can_trace.h"
#include "esphome/components/web_server_base/web_server_base.h"
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace pyromat {

// Registered through WebServerBase::add_handler(), which enforces the
// already-configured Digest authentication. There are NO write endpoints.
class CanTraceHandler final : public AsyncWebHandler {
 public:
  explicit CanTraceHandler(CanTrace &recorder) : recorder_(recorder) {}

  bool canHandle(AsyncWebServerRequest *request) const override {
    if (request->method() != HTTP_GET) return false;
    char url[AsyncWebServerRequest::URL_BUF_SIZE];
    return request->url_to(url) == "/can/trace";
  }

  void handleRequest(AsyncWebServerRequest *request) override {
    uint32_t cursor = 0;
    if (auto *parameter = request->getParam("after")) {
      const std::string &raw = parameter->value();
      if (raw.empty() || raw.size() > 10 || raw.find_first_not_of("0123456789") != std::string::npos) {
        request->send(400, "text/plain", "Invalid cursor");
        return;
      }
      const auto parsed = std::strtoull(raw.c_str(), nullptr, 10);
      if (parsed > UINT32_MAX) {
        request->send(400, "text/plain", "Invalid cursor");
        return;
      }
      cursor = static_cast<uint32_t>(parsed);
    }
    const auto state = recorder_.snapshot(cursor, 96);
    std::string body;
    body.reserve(150 + state.frames.size() * 100);
    char row[150];
    std::snprintf(row, sizeof(row),
                  "{\"running\":%s,\"generation\":%lu,\"last_sequence\":%lu,\"overwritten\":%lu,\"missed\":%lu,\"buffered\":%lu,\"capacity\":%lu,\"frames\":[",
                  state.running ? "true" : "false", static_cast<unsigned long>(state.generation),
                  static_cast<unsigned long>(state.last_sequence), static_cast<unsigned long>(state.overwritten),
                  static_cast<unsigned long>(state.missed), static_cast<unsigned long>(state.buffered),
                  static_cast<unsigned long>(state.capacity));
    body += row;
    for (size_t i = 0; i < state.frames.size(); ++i) {
      const auto &frame = state.frames[i];
      if (i) body += ',';
      std::snprintf(row, sizeof(row),
                    "{\"seq\":%lu,\"ms\":%lu,\"id\":%lu,\"ext\":%s,\"rtr\":%s,\"data\":\"",
                    static_cast<unsigned long>(frame.sequence), static_cast<unsigned long>(frame.uptime_ms),
                    static_cast<unsigned long>(frame.can_id), frame.extended ? "true" : "false",
                    frame.rtr ? "true" : "false");
      body += row;
      for (size_t j = 0; j < frame.length; ++j) {
        char hex[3];
        std::snprintf(hex, sizeof(hex), "%02X", frame.data[j]);
        body += hex;
      }
      body += "\"}";
    }
    body += "]}";
    auto *response = request->beginResponse(200, "application/json; charset=utf-8", body);
    response->addHeader("Cache-Control", "no-store");
    request->send(response);
  }

 private:
  CanTrace &recorder_;
};

inline void register_trace_handler() {
  auto *base = esphome::web_server_base::global_web_server_base;
  if (base != nullptr) base->add_handler(new CanTraceHandler(trace()));
}
} // namespace pyromat
