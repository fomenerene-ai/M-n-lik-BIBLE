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
 * @returns {Promise<{stream: MediaStream, ctx: AudioContext, source: MediaStreamAudioSourceNode, level: () => number, close: () => void}>}
 */
export async function openMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw micError({ name: 'NotFoundError' });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
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
