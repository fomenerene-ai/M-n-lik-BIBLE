/**
 * Microphone access. Audio stays in memory and is discarded: nothing is ever stored.
 */

function micError(e) {
  const name = e && e.name;
  const kind = name === 'NotAllowedError' || name === 'SecurityError' ? 'no-mic' : name === 'NotFoundError' || name === 'NotReadableError' ? 'no-mic-device' : 'mic';
  return Object.assign(new Error(`Microphone error: ${name || e}`), { kind });
}

/**
 * Opens the microphone with an analyser for level metering.
 * @param {{raw?: boolean}} [o] raw: no noise suppression or gain control (keeps the pitch contour intact)
 * @returns {Promise<{stream: MediaStream, ctx: AudioContext, source: MediaStreamAudioSourceNode, level: () => number, close: () => void}>}
 */
export async function openMic(o = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw micError({ name: 'NotFoundError' });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: !o.raw, autoGainControl: !o.raw } });
  } catch (e) { throw micError(e); }
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  return {
    stream, ctx, source,
    /** RMS level 0..1 of the latest frame. */
    level() {
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    },
    close() {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

/**
 * Records the microphone into memory until stop() is called.
 * @param {{onLevel?: (rms: number) => void}} [o]
 * @returns {Promise<{stop: () => {samples: Float32Array, rate: number, peak: number}, cancel: () => void}>}
 */
export async function startRecording(o = {}) {
  const mic = await openMic({ raw: true });
  const chunks = [];
  let peak = 0;
  const onData = (data) => {
    let e = 0;
    for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; e += data[i] * data[i]; }
    chunks.push(data);
    if (o.onLevel) o.onLevel(Math.sqrt(e / data.length));
  };
  let node;
  const sink = mic.ctx.createGain();
  sink.gain.value = 0;
  sink.connect(mic.ctx.destination);
  if (mic.ctx.audioWorklet) {
    await mic.ctx.audioWorklet.addModule(new URL('./recorder-worklet.js', import.meta.url));
    node = new AudioWorkletNode(mic.ctx, 'parley-recorder');
    node.port.onmessage = (e) => onData(e.data);
  } else {
    node = mic.ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => onData(new Float32Array(e.inputBuffer.getChannelData(0)));
  }
  mic.source.connect(node);
  node.connect(sink);
  if (mic.ctx.state === 'suspended') await mic.ctx.resume();
  const rate = mic.ctx.sampleRate;
  const finish = () => {
    try { mic.source.disconnect(); node.disconnect(); } catch { /* already disconnected */ }
    mic.close();
  };
  return {
    stop() {
      finish();
      const n = chunks.reduce((s, c) => s + c.length, 0);
      const samples = new Float32Array(n);
      let off = 0;
      for (const c of chunks) { samples.set(c, off); off += c.length; }
      chunks.length = 0;
      return { samples, rate, peak };
    },
    cancel() { finish(); chunks.length = 0; },
  };
}
