"""Procedural ambient soundscapes (numpy DSP, fully local and licence-free)."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SR = 22050
DUR = 20.0


def _lp(x, a):  # one-pole low-pass, a in (0,1): higher = darker
    return lfilter([1 - a], [1, -a], x)


def _brown(n, rng):
    return _lp(rng.standard_normal(n), 0.995) * 8


def _env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def _scatter(out, rng, count, make):
    n = len(out)
    for _ in range(count):
        ev = make()
        start = rng.integers(0, max(1, n - len(ev)))
        seg = ev[: n - start]
        out[start:start + len(seg)] += seg


def _tone(freq, dur, decay, sweep=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + sweep * t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.005, decay)


def _rain(t, rng):
    n = len(t)
    x = rng.standard_normal(n)
    x = x - _lp(x, 0.9)
    bed = _lp(x, 0.6) * 0.35
    _scatter(bed, rng, 400, lambda: rng.standard_normal(int(0.01 * SR)) * _env(int(0.01 * SR), 0.0005, 0.003) * 0.6)
    return bed


def _wind(t, rng):
    mod = 0.55 + 0.45 * np.sin(2 * np.pi * t / 6.7) * np.sin(2 * np.pi * t / 3.1 + 1)
    return _lp(rng.standard_normal(len(t)), 0.97) * 4 * mod


def _sea(t, rng):
    swell = (0.5 + 0.5 * np.sin(2 * np.pi * t / 6.5)) ** 2
    return _lp(rng.standard_normal(len(t)), 0.93) * 2.2 * swell + _brown(len(t), rng) * 0.25


def _forest(t, rng):
    out = _wind(t, rng) * 0.35
    _scatter(out, rng, 28, lambda: _tone(rng.uniform(2500, 4200), rng.uniform(0.08, 0.2), 0.06, sweep=rng.uniform(-0.4, 0.5)) * 0.25)
    return out


def _fire(t, rng):
    out = _brown(len(t), rng) * 0.6
    _scatter(out, rng, 260, lambda: rng.standard_normal(int(0.006 * SR)) * rng.uniform(0.2, 0.9))
    return out


def _night(t, rng):
    pulses = (np.sin(2 * np.pi * 30 * t) > 0.3) * (np.sin(2 * np.pi * 0.9 * t) > 0)
    crickets = np.sin(2 * np.pi * 4400 * t) * pulses * 0.12
    return crickets + _wind(t, rng) * 0.15


def _space(t, rng):
    drone = sum(np.sin(2 * np.pi * f * t + p) / (k + 1) for k, (f, p) in enumerate([(55, 0), (82.5, 1), (110.3, 2)]))
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * t / 9)
    return drone * 0.35 * lfo + _lp(rng.standard_normal(len(t)), 0.98) * 0.6


def _cave(t, rng):
    out = np.sin(2 * np.pi * 48 * t) * 0.15 + _brown(len(t), rng) * 0.15

    def drip():
        d = _tone(rng.uniform(900, 1600), 0.6, 0.08, sweep=0.6)
        echo = np.zeros(len(d) + int(0.25 * SR))
        echo[: len(d)] += d
        echo[int(0.25 * SR):] += d * 0.35
        return echo * 0.5

    _scatter(out, rng, 14, drip)
    return out


def _city(t, rng):
    out = _brown(len(t), rng) * 0.7 + _lp(rng.standard_normal(len(t)), 0.9) * 0.3
    _scatter(out, rng, 4, lambda: _tone(rng.uniform(300, 500), 0.7, 0.4) * 0.12)
    return out


def _storm(t, rng):
    out = _rain(t, rng)

    def thunder():
        n = int(3.5 * SR)
        return _lp(rng.standard_normal(n), 0.998) * 40 * _env(n, 0.05, 1.2)

    _scatter(out, rng, 3, thunder)
    return out


def _magic(t, rng):
    pad = sum(np.sin(2 * np.pi * f * t) for f in (220, 277.2, 329.6)) * 0.08 * (0.7 + 0.3 * np.sin(2 * np.pi * t / 7))
    out = pad.copy()
    scale = [880, 987.8, 1174.7, 1318.5, 1568, 1760]
    _scatter(out, rng, 45, lambda: _tone(rng.choice(scale), 1.2, 0.35) * 0.18)
    return out


def _music_box(t, rng):
    out = np.zeros(len(t))
    melody = [659.3, 587.3, 523.3, 587.3, 659.3, 659.3, 659.3, 587.3, 587.3, 659.3, 784, 784]
    step = 0.55
    for k in range(int(DUR / step)):
        f = melody[k % len(melody)]
        note = _tone(f, 1.5, 0.5) + _tone(f * 2, 1.5, 0.2) * 0.3  # same length: avoids a broadcast error
        s = int(k * step * SR)
        seg = note[: len(out) - s]
        out[s:s + len(seg)] += seg * 0.22
    return out


SYNTHS = {
    "lluvia": _rain, "tormenta": _storm, "viento": _wind, "mar": _sea, "bosque": _forest,
    "fuego": _fire, "noche": _night, "espacio": _space, "cueva": _cave, "ciudad": _city,
    "magia": _magic, "caja_musical": _music_box,
}


def _norm(x):
    return x / (np.abs(x).max() + 1e-6)


def generate(tag: str, bed_tag: str, seed: int, path: str) -> None:
    rng = np.random.default_rng(seed)
    t = np.arange(int(DUR * SR)) / SR
    x = SYNTHS[tag](t, rng)
    if bed_tag and bed_tag != tag:
        x = _norm(x) + 0.3 * _norm(SYNTHS[bed_tag](t, rng))
    fade = int(1.5 * SR)  # crossfade tail into head for a seamless loop
    x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:-fade]
    x = _norm(x) * 0.8
    wavfile.write(path, SR, (x * 32767).astype(np.int16))
