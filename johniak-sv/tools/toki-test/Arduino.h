#pragma once
#include <cstdint>
#include <cstdio>
typedef uint8_t byte;
extern uint32_t FAKE_MILLIS;
static inline uint32_t millis() { return FAKE_MILLIS; }
static inline uint16_t word(uint8_t h, uint8_t l) { return (uint16_t)((h << 8) | l); }
#define PSTR(x) x
struct Print { void printf_P(const char *f, ...) {} };
extern Print Serial;
