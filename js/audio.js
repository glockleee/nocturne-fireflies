/* =========================================================
   星海萤光 · 声音引擎
   纯 Web Audio 实时合成：环境铺底、钟琴、点击音效与混响
   ========================================================= */

(function (global) {
  'use strict';

  var mtof = function (midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  };

  var clamp = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };

  var rand = function (a, b) {
    return a + Math.random() * (b - a);
  };

  var pick = function (arr) {
    return arr[(Math.random() * arr.length) | 0];
  };

  /* 和弦：A 小调色彩，加九音让夜色更柔软 */
  var CHORDS = [
    { notes: [45, 52, 57, 59, 60, 64], root: 45, name: 'Am9' },
    { notes: [41, 48, 57, 60, 64, 67], root: 41, name: 'Fmaj9' },
    { notes: [48, 55, 59, 62, 64, 67], root: 48, name: 'Cmaj9' },
    { notes: [43, 50, 55, 57, 59, 64], root: 43, name: 'G6/9' }
  ];

  var chimeSequence = [69, 72, 74, 76, 79, 81, 84, 81, 79, 76];

  function impulseResponse(ctx, seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buffer = ctx.createBuffer(2, len, rate);
    var fadeIn = Math.max(1, Math.floor(rate * 0.006));

    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        if (i < fadeIn) n *= i / fadeIn;
        data[i] = n;
      }
    }
    return buffer;
  }

  function noiseBuffer(ctx, seconds) {
    var rate = ctx.sampleRate;
    var len = Math.floor(rate * seconds);
    var buffer = ctx.createBuffer(1, len, rate);
    var data = buffer.getChannelData(0);
    var last = 0;

    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  var AudioEngine = {
    ctx: null,
    started: false,
    muted: false,

    init: function () {
      if (this.ctx) return this.ctx;

      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;

      var ctx = new AC();
      this.ctx = ctx;

      var master = ctx.createGain();
      master.gain.value = 0.0001;

      var compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 26;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.015;
      compressor.release.value = 0.35;

      var analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.86;

      master.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      var reverb = ctx.createConvolver();
      reverb.buffer = impulseResponse(ctx, 4.6, 2.5);

      var wet = ctx.createGain();
      wet.gain.value = 0.6;
      reverb.connect(wet);
      wet.connect(master);

      var dry = ctx.createGain();
      dry.gain.value = 0.72;
      dry.connect(master);

      var music = ctx.createGain();
      music.gain.value = 0.92;
      music.connect(dry);
      music.connect(reverb);

      var sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(dry);
      sfx.connect(reverb);

      /* 回声 */
      var delay = ctx.createDelay(2);
      delay.delayTime.value = 0.46;

      var feedback = ctx.createGain();
      feedback.gain.value = 0.3;

      var damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2600;

      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);

      var echoOut = ctx.createGain();
      echoOut.gain.value = 0.26;
      damp.connect(echoOut);
      echoOut.connect(master);

      this.master = master;
      this.analyser = analyser;
      this.reverb = reverb;
      this.music = music;
      this.sfx = sfx;
      this.delay = delay;
      this.wet = wet;
      this.dry = dry;
      this.buffer = new Uint8Array(analyser.fftSize);
      this._level = 0;
      this._chimeStep = 0;
      this._noise = null;

      return ctx;
    },

    start: function () {
      var self = this;
      var ctx = this.init();
      if (!ctx) return Promise.resolve(false);

      var resume = ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(function () {});

      return resume.then(function () {
        var now = ctx.currentTime;

        if (!self.started) {
          self.started = true;
          self.muted = false;

          self.master.gain.cancelScheduledValues(now);
          self.master.gain.setValueAtTime(Math.max(self.master.gain.value, 0.0001), now);
          self.master.gain.exponentialRampToValueAtTime(0.7, now + 3.6);

          self._startPad(now);
          self._startBells();
          self._startWind(now);

          /* 入场的一串光 */
          var introNotes = [69, 72, 76, 81, 84, 88];
          for (var i = 0; i < introNotes.length; i++) {
            self.pluck(introNotes[i], {
              when: now + 0.7 + i * 0.26,
              gain: 0.1 - i * 0.008,
              pan: (i - 2.5) * 0.18,
              wet: 0.85,
              decay: 3.8
            });
          }
        } else {
          self.setMuted(false);
        }

        return true;
      });
    },

    setMuted: function (muted) {
      this.muted = !!muted;
      if (!this.ctx || !this.started) return;

      var t = this.ctx.currentTime;
      var gain = this.master.gain;
      gain.cancelScheduledValues(t);
      gain.setTargetAtTime(this.muted ? 0.0001 : 0.7, t, 0.22);
    },

    isAudible: function () {
      return this.started && !this.muted;
    },

    /* ---------- 铺底 ---------- */

    _startPad: function (now) {
      var self = this;
      this._chordIndex = 0;
      this._nextChord = now + 0.2;

      var schedule = function () {
        if (!self.started) return;
        var t = self.ctx.currentTime;

        while (self._nextChord < t + 2) {
          self._playChord(CHORDS[self._chordIndex % CHORDS.length], self._nextChord, 19);
          self._nextChord += 15;
          self._chordIndex++;
        }
        self._padTimer = setTimeout(schedule, 900);
      };

      schedule();
    },

    _playChord: function (chord, when, dur) {
      var ctx = this.ctx;
      var attack = dur > 12 ? 4.2 : 2.6;
      var release = 5;
      var end = when + dur;

      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1050;
      filter.Q.value = 0.6;

      var lfo = ctx.createOscillator();
      lfo.frequency.value = rand(0.024, 0.048);
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 420;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      var envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0.0001, when);
      envelope.gain.linearRampToValueAtTime(1, when + attack);
      envelope.gain.setValueAtTime(1, end - release);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);

      filter.connect(envelope);
      envelope.connect(this.music);

      var noteCount = chord.notes.length;
      var voiceGain = 0.058 / Math.sqrt(noteCount / 4);

      for (var i = 0; i < noteCount; i++) {
        var note = chord.notes[i];
        var freq = mtof(note);
        var detune = rand(-4, 4);

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        var osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = freq;
        osc2.detune.value = detune + 5;

        var g2 = ctx.createGain();
        g2.gain.value = 0.16;

        var g = ctx.createGain();
        g.gain.value = voiceGain * (i === 0 ? 1.12 : 1);

        osc.connect(g);
        osc2.connect(g2);
        g2.connect(g);
        g.connect(filter);

        osc.start(when);
        osc2.start(when);
        osc.stop(end + 0.2);
        osc2.stop(end + 0.2);
      }

      /* 高处的一点空气 */
      var air = ctx.createOscillator();
      air.type = 'sine';
      air.frequency.value = mtof(chord.root + 24);
      var airGain = ctx.createGain();
      airGain.gain.setValueAtTime(0.0001, when);
      airGain.gain.linearRampToValueAtTime(0.011, when + attack + 1);
      airGain.gain.exponentialRampToValueAtTime(0.0001, end);
      air.connect(airGain);
      airGain.connect(this.music);
      air.start(when);
      air.stop(end + 0.2);

      lfo.start(when);
      lfo.stop(end + 0.2);
    },

    _startWind: function (now) {
      var ctx = this.ctx;
      if (!this._noise) this._noise = noiseBuffer(ctx, 6);

      var src = ctx.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;

      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 160;

      var band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 620;
      band.Q.value = 0.7;

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 9);

      var lfo = ctx.createOscillator();
      lfo.frequency.value = 0.037;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 240;
      lfo.connect(lfoGain);
      lfoGain.connect(band.frequency);

      var breathe = ctx.createOscillator();
      breathe.frequency.value = 0.061;
      var breatheGain = ctx.createGain();
      breatheGain.gain.value = 0.016;
      breathe.connect(breatheGain);
      breatheGain.connect(gain.gain);

      src.connect(hp);
      hp.connect(band);
      band.connect(gain);
      gain.connect(this.music);

      src.start(now);
      lfo.start(now);
      breathe.start(now);

      this._wind = { src: src, band: band, gain: gain, lfo: lfo, breathe: breathe };
    },

    _startBells: function () {
      var self = this;

      var loop = function () {
        if (!self.started) return;

        self._bellTimer = setTimeout(function () {
          if (!self.started) return;
          var note = pick([69, 72, 74, 76, 79, 81, 84, 86]);
          self.pluck(note, {
            gain: rand(0.075, 0.11),
            pan: rand(-0.78, 0.78),
            wet: 0.8,
            decay: rand(3.6, 4.8),
            when: self.ctx.currentTime + 0.05
          });
          loop();
        }, rand(4800, 9800));
      };

      loop();
    },

    /* ---------- 单音 ---------- */

    pluck: function (midi, opts) {
      if (!this.ctx || !this.started) return;
      opts = opts || {};

      var ctx = this.ctx;
      var when = typeof opts.when === 'number' ? opts.when : ctx.currentTime + 0.02;
      var freq = mtof(midi);
      var peak = typeof opts.gain === 'number' ? opts.gain : 0.12;
      var decay = opts.decay || 2.8;
      var pan = clamp(typeof opts.pan === 'number' ? opts.pan : 0, -1, 1);
      var wet = typeof opts.wet === 'number' ? opts.wet : 0.55;

      var panner = ctx.createStereoPanner();
      panner.pan.value = pan;

      var carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq * 1.008, when);
      carrier.frequency.exponentialRampToValueAtTime(freq, when + 0.22);

      var mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = freq * 3.005;

      var modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freq * 1.15, when);
      modGain.gain.exponentialRampToValueAtTime(freq * 0.03, when + Math.min(1.1, decay * 0.5));
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), when + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, when + decay);

      carrier.connect(env);
      env.connect(panner);

      var shimmer = ctx.createOscillator();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(freq * 2.004, when);
      shimmer.frequency.exponentialRampToValueAtTime(freq * 2, when + decay);

      var shimmerEnv = ctx.createGain();
      shimmerEnv.gain.setValueAtTime(0.0001, when);
      shimmerEnv.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.2), when + 0.01);
      shimmerEnv.gain.exponentialRampToValueAtTime(0.0001, when + decay * 0.55);

      shimmer.connect(shimmerEnv);
      shimmerEnv.connect(panner);

      panner.connect(this.sfx);

      var send = ctx.createGain();
      send.gain.value = wet * 0.32;
      panner.connect(send);
      send.connect(this.delay);

      carrier.start(when);
      mod.start(when);
      shimmer.start(when);

      var stopAt = when + decay + 0.15;
      carrier.stop(stopAt);
      mod.stop(stopAt);
      shimmer.stop(stopAt);
    },

    /* ---------- 交互音效 ---------- */

    chime: function (x, y) {
      if (!this.isAudible()) return;

      var ctx = this.ctx;
      var self = this;
      var note = chimeSequence[this._chimeStep % chimeSequence.length];
      this._chimeStep++;

      var pan = clamp((x - 0.5) * 1.5, -0.82, 0.82);
      var gain = rand(0.14, 0.19);

      this.pluck(note, {
        gain: gain,
        pan: pan,
        wet: 0.7,
        decay: rand(2.6, 3.4),
        when: ctx.currentTime + 0.015
      });

      if (Math.random() < 0.5) {
        this.pluck(note + 12, {
          gain: gain * 0.26,
          pan: -pan * 0.6,
          wet: 0.9,
          decay: 2.2,
          when: ctx.currentTime + 0.055
        });
      }

      /* 细碎的高频闪光 */
      var now = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = this._noise || (this._noise = noiseBuffer(ctx, 6));

      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = rand(3800, 6200);

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.028, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

      var p = ctx.createStereoPanner();
      p.pan.value = pan;

      src.connect(hp);
      hp.connect(g);
      g.connect(p);
      p.connect(this.sfx);

      src.start(now, rand(0, 2), 0.4);

      /* 让低处也有一点厚度 */
      if (Math.random() < 0.35) {
        var sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(rand(70, 92), now);
        sub.frequency.exponentialRampToValueAtTime(rand(52, 64), now + 0.7);

        var subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        sub.connect(subGain);
        subGain.connect(this.dry);

        sub.start(now);
        sub.stop(now + 0.9);
      }
    },

    /* 拖动时更轻的一声 */
    whisper: function (x) {
      if (!this.isAudible()) return;
      var note = pick([81, 84, 86, 88, 91]);
      this.pluck(note, {
        gain: 0.035,
        pan: clamp((x - 0.5) * 1.2, -0.7, 0.7),
        wet: 0.9,
        decay: 1.9,
        when: this.ctx.currentTime + 0.01
      });
    },

    click: function () {
      if (!this.isAudible()) return;
      var now = this.ctx.currentTime;
      this.pluck(84, { gain: 0.075, pan: 0.22, wet: 0.5, decay: 1.5, when: now + 0.01 });
      this.pluck(91, { gain: 0.045, pan: -0.2, wet: 0.6, decay: 1.2, when: now + 0.075 });
    },

    swell: function () {
      if (!this.isAudible()) return;
      var ctx = this.ctx;
      var now = ctx.currentTime;

      var src = ctx.createBufferSource();
      src.buffer = this._noise || (this._noise = noiseBuffer(ctx, 6));

      var band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.1;
      band.frequency.setValueAtTime(260, now);
      band.frequency.exponentialRampToValueAtTime(2400, now + 1.5);

      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.03, now + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      src.connect(band);
      band.connect(g);
      g.connect(this.sfx);
      g.connect(this.delay);
      src.start(now);
      src.stop(now + 1.9);
    },

    shower: function () {
      if (!this.isAudible()) return;
      var notes = [81, 84, 86, 88, 91, 93, 96];
      var now = this.ctx.currentTime;
      for (var i = 0; i < notes.length; i++) {
        this.pluck(notes[i], {
          gain: 0.05,
          pan: rand(-0.8, 0.8),
          wet: 0.85,
          decay: 2.6,
          when: now + 0.05 + i * 0.11
        });
      }
    },

    /* ---------- 可视化电平 ---------- */

    level: function () {
      if (!this.analyser || !this.started || this.muted) {
        this._level = (this._level || 0) * 0.9;
        return this._level;
      }

      this.analyser.getByteTimeDomainData(this.buffer);

      var sum = 0;
      var step = 4;
      var count = 0;
      for (var i = 0; i < this.buffer.length; i += step) {
        var v = (this.buffer[i] - 128) / 128;
        sum += v * v;
        count++;
      }

      var rms = Math.sqrt(sum / Math.max(1, count));
      var target = clamp(rms * 4.4, 0, 1);
      this._level += (target - this._level) * 0.12;
      return this._level;
    }
  };

  global.NocturneAudio = AudioEngine;
})(window);
