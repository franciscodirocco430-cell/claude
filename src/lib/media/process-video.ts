/**
 * Video processing abstraction.
 *
 * Vercel Functions are not a good place to run ffmpeg-style transcoding,
 * frame extraction, or transcription on anything but trivially small files:
 * execution time and memory are capped, and there is no persistent disk.
 * This module defines the pipeline's shape and implements only the steps
 * that are safe to run inside a serverless function today. Steps that need
 * heavier processing are left as explicit adapter interfaces — wiring them
 * up later means implementing `VideoProcessingAdapter` against a real
 * worker (e.g. a queue-triggered Fly.io/Cloud Run job, or a managed API
 * like Mux/AssemblyAI) and swapping the export at the bottom of this file.
 * Nothing upstream needs to change.
 */

export interface VideoMetadata {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Populated client-side (HTMLVideoElement) before upload; not derivable
   * server-side without decoding the file. */
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export interface ExtractedFrame {
  timestampSeconds: number;
  storagePath: string;
}

export interface VideoProcessingResult {
  metadata: VideoMetadata;
  thumbnailStoragePath: string | null;
  transcript: string | null;
  frames: ExtractedFrame[];
  /** True once every step that could run actually ran. False means some
   * steps were skipped because no worker adapter is configured — the UI
   * must say so rather than pretending the data exists. */
  isComplete: boolean;
  skippedSteps: string[];
}

export interface VideoProcessingAdapter {
  /** Generates a poster-frame thumbnail. Requires decoding the video. */
  generateThumbnail(input: { storagePath: string }): Promise<string | null>;
  /** Extracts N representative frames across the timeline. */
  extractFrames(input: { storagePath: string; count: number }): Promise<ExtractedFrame[]>;
  /** Extracts the audio track and transcribes it. */
  transcribeAudio(input: { storagePath: string }): Promise<string | null>;
}

/**
 * No-op adapter: makes every heavy step explicit about not having run,
 * instead of silently returning fabricated data. This is the default until
 * a real worker (see module docstring) is configured via
 * `VIDEO_WORKER_ADAPTER` / a future implementation swapped in below.
 */
class UnavailableVideoProcessingAdapter implements VideoProcessingAdapter {
  async generateThumbnail() {
    return null;
  }
  async extractFrames() {
    return [];
  }
  async transcribeAudio() {
    return null;
  }
}

function getVideoProcessingAdapter(): VideoProcessingAdapter {
  // Future: branch on an env var (e.g. VIDEO_WORKER_ADAPTER=mux|assemblyai)
  // and return a real implementation that calls out to that service.
  return new UnavailableVideoProcessingAdapter();
}

export async function processVideo(input: {
  storagePath: string;
  metadata: VideoMetadata;
}): Promise<VideoProcessingResult> {
  const adapter = getVideoProcessingAdapter();
  const skippedSteps: string[] = [];

  const thumbnailStoragePath = await adapter.generateThumbnail({
    storagePath: input.storagePath,
  });
  if (!thumbnailStoragePath) skippedSteps.push("thumbnail_generation");

  const frames = await adapter.extractFrames({
    storagePath: input.storagePath,
    count: 5,
  });
  if (frames.length === 0) skippedSteps.push("frame_extraction");

  const transcript = await adapter.transcribeAudio({
    storagePath: input.storagePath,
  });
  if (!transcript) skippedSteps.push("audio_transcription");

  return {
    metadata: input.metadata,
    thumbnailStoragePath,
    transcript,
    frames,
    isComplete: skippedSteps.length === 0,
    skippedSteps,
  };
}
