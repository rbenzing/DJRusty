/**
 * audioDecoder.ts — Web Audio API audio file decoding utility.
 *
 * Provides a clean interface for decoding audio files into AudioBuffers
 * that can be used with the AudioEngine.
 */

import { getAudioContext } from './audioContext';

/**
 * Decode an audio file into an AudioBuffer.
 * Supports both File objects (from file input) and ArrayBuffer (from other sources).
 *
 * @param source - The audio file to decode
 * @returns Promise resolving to the decoded AudioBuffer
 * @throws Error if decoding fails (corrupt file, unsupported format, etc.)
 */
export async function decodeAudioFile(source: File | ArrayBuffer): Promise<AudioBuffer> {
  const context = getAudioContext();

  let arrayBuffer: ArrayBuffer;

  if (source instanceof File) {
    // Convert File to ArrayBuffer
    arrayBuffer = await source.arrayBuffer();
  } else {
    // Source is already an ArrayBuffer
    arrayBuffer = source;
  }

  // Decode using Web Audio API
  try {
    return await context.decodeAudioData(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to decode audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}