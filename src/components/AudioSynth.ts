/**
 * RETRO 8-BIT AUDIO SYNTHESIZER
 * Custom chiptune synth using Web Audio API so no audio files needed!
 */

class AudioSynth {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private musicInterval: any = null;
  private isMusicPlaying = false;
  private bpm = 120;
  private musicTempo = 0.25; // Beat duration
  private lastNoteTime = 0;
  private noteIndex = 0;
  private enabled = true;

  constructor() {
    // Initialized lazily on first user interaction to satisfy browser policies
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.15, this.ctx.currentTime); // keep it elegant and not too loud
      this.masterVolume.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported in this environment.", e);
    }
  }

  public setVolume(vol: number) {
    this.init();
    if (this.masterVolume && this.ctx) {
      this.masterVolume.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public toggleMute() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public isEnabled() {
    return this.enabled;
  }

  // Plays a classic retro jump sound (frequency sweeping quickly up)
  public playJump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle'; // 8-bit nostalgic chip sound
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.17);
  }

  // Plays an 8-bit coin sound (arpeggio of two clean high notes)
  public playCoin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();

    const now = this.ctx.currentTime;
    
    // First note (high B)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(this.masterVolume);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Second note (even higher E)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6
    gain2.gain.setValueAtTime(0.15, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(this.masterVolume);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.31);
  }

  // Plays a classic retro damage sound (low pitch sweep down with noise-like oscillation)
  public playHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start();
    osc.stop(now + 0.27);
  }

  // Sad retro melody for Game Over
  public playGameOver() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();
    this.stopMusic();

    const now = this.ctx.currentTime;
    const notes = [293.66, 277.18, 261.63, 196.00]; // D4, C#4, C4, G3
    const durations = [0.15, 0.15, 0.15, 0.4];
    
    let timeOffset = 0;
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      gain.gain.setValueAtTime(0.25, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + durations[idx] - 0.02);
      
      osc.connect(gain);
      gain.connect(this.masterVolume!);
      
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + durations[idx]);
      
      timeOffset += durations[idx];
    });
  }

  // Plays a level-up or checkpoint sound (happy arpeggio)
  public playScoreMilestone() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();

    const now = this.ctx.currentTime;
    // Major triad arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.12, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.07 + 0.15);
      
      osc.connect(gain);
      gain.connect(this.masterVolume!);
      
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.18);
    });
  }

  // Plays a UI selection beep
  public playBeep() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start();
    osc.stop(now + 0.09);
  }

  private resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generates procedural retro background music!
  public startMusic() {
    if (!this.enabled || this.isMusicPlaying) return;
    this.init();
    if (!this.ctx || !this.masterVolume) return;

    this.resumeContext();
    this.isMusicPlaying = true;
    this.noteIndex = 0;

    // Classic 8-bit retro loop melody & bassline
    // Sequence of notes in Am key: A2, E3, A3, G3, F2, C3, F3, E3...
    const bassline = [
      110.00, 164.81, 220.00, 196.00, // A2, E3, A3, G3
      87.31, 130.81, 174.61, 164.81,  // F2, C3, F3, E3
      98.00, 146.83, 196.00, 174.61,  // G2, D3, G3, F3
      82.41, 123.47, 164.81, 220.00   // E2, B2, E3, A3
    ];

    const melody = [
      440.00, 0, 523.25, 587.33,
      659.25, 0, 587.33, 523.25,
      392.00, 0, 440.00, 493.88,
      523.25, 493.88, 440.00, 329.63
    ];

    const beatDuration = 60 / this.bpm / 2; // eighth notes

    const playStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.masterVolume) return;

      const now = this.ctx.currentTime;
      
      // Play bass note (subtle triangle)
      const bassFreq = bassline[this.noteIndex % bassline.length];
      const bassNode = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassNode.type = 'triangle';
      bassNode.frequency.setValueAtTime(bassFreq, now);
      bassGain.gain.setValueAtTime(0.08, now);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + beatDuration - 0.02);
      
      bassNode.connect(bassGain);
      bassGain.connect(this.masterVolume);
      bassNode.start(now);
      bassNode.stop(now + beatDuration);

      // Play melody note occasionally (square wave)
      const melFreq = melody[this.noteIndex % melody.length];
      if (melFreq > 0 && Math.random() > 0.3) {
        const melNode = this.ctx.createOscillator();
        const melGain = this.ctx.createGain();
        melNode.type = 'square';
        melNode.frequency.setValueAtTime(melFreq, now);
        melGain.gain.setValueAtTime(0.03, now);
        melGain.gain.exponentialRampToValueAtTime(0.001, now + beatDuration * 1.5 - 0.02);
        
        melNode.connect(melGain);
        melGain.connect(this.masterVolume);
        melNode.start(now);
        melNode.stop(now + beatDuration * 1.5);
      }

      this.noteIndex++;
      this.musicInterval = setTimeout(playStep, beatDuration * 1000);
    };

    playStep();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audioSynth = new AudioSynth();
