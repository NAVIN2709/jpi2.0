// voice.js
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import dotenv from 'dotenv';
dotenv.config();

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// ============ VOICE MAPPING ============
const VOICE_MAP = {
  rachel: 'JBFqnCBsd6RMkjVDRZzb',      // Clear, Professional (Female)
  bella: '21m00Tcm4TlvDq8ikWAM',       // Warm, Expressive (Female)
  antoni: 'EXAVITQu4vr4xnSDxMaL',      // Deep, Calm (Male)
  arnold: 'pFZP5JQG7iQjIQuC4Iy5',      // Bold, Energetic (Male)
  dorothy: 'TxGEqnHWrfWFTfGW9XjX'      // Educational (Female)
};

const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

// ============ GENERATE SINGLE VOICEOVER ============
export async function generateVoiceover(narration, voiceKey = 'rachel') {
  try {
    if (!narration || narration.trim().length === 0) {
      console.log(`⏭️  Skipping empty narration`);
      return null;
    }

    const voiceId = VOICE_MAP[voiceKey];
    if (!voiceId) {
      throw new Error(`Unknown voice: ${voiceKey}`);
    }

    console.log(`🎤 Generating voiceover (${voiceKey}): "${narration.substring(0, 50)}..."`);

    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text: narration,
      modelId: MODEL_ID,
      outputFormat: OUTPUT_FORMAT
    });

    // Create voiceovers directory if it doesn't exist
    await fs.mkdir('./voiceovers', { recursive: true });

    const filename = `voiceover_${Date.now()}.mp3`;
    const filePath = path.join('./voiceovers', filename);

    await fs.writeFile(filePath, audio);

    console.log(`✅ Voiceover saved: ${filePath}`);

    // Estimate duration (rough: chars / 14 = seconds)
    const estimatedDuration = Math.ceil(narration.length / 14);

    return {
      success: true,
      filePath,
      filename,
      duration: estimatedDuration,
      narration
    };
  } catch (error) {
    console.error(`❌ Voiceover generation failed: ${error.message}`);
    return null;
  }
}

// ============ GENERATE ALL VOICEOVERS FROM SCENE ============
export async function generateAllVoiceovers(scene) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎤 GENERATING VOICEOVERS');
    console.log(`${'='.repeat(60)}\n`);

    const voiceovers = [];

    for (const phase of scene.phases) {
      if (!phase.voiceover) {
        console.log(`⏭️  Phase "${phase.name}": No voiceover`);
        continue;
      }

      const result = await generateVoiceover(
        phase.voiceover,
        'rachel' // Default voice
      );

      if (result) {
        voiceovers.push({
          phaseName: phase.name,
          phaseTime: phase.time,
          ...result
        });
      }
    }

    console.log(`\n✅ Generated ${voiceovers.length}/${scene.phases.length} voiceovers\n`);

    return voiceovers;
  } catch (error) {
    console.error(`❌ Batch generation failed: ${error.message}`);
    throw error;
  }
}

// ============ CONCATENATE AUDIO FILES ============
export async function concatenateAudioFiles(audioFiles) {
  try {
    if (audioFiles.length === 0) {
      console.log(`⚠️  No audio files to concatenate`);
      return null;
    }

    if (audioFiles.length === 1) {
      console.log(`📦 Single audio file, skipping concatenation`);
      return audioFiles[0];
    }

    console.log(`\n📚 Concatenating ${audioFiles.length} audio files...`);

    const concatPath = './voiceovers/concat.txt';

    // Create concat file
    const concatContent = audioFiles
      .map(file => `file '${path.resolve(file)}'`)
      .join('\n');

    await fs.writeFile(concatPath, concatContent);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatPath,
        '-c', 'copy',
        './voiceovers/concatenated.mp3'
      ]);

      let error = '';

      ffmpeg.stderr.on('data', (data) => {
        error += data.toString();
      });

      ffmpeg.on('close', (code) => {
        // Clean up concat file
        fs.unlink(concatPath).catch(() => {});

        if (code === 0) {
          console.log(`✅ Audio concatenated: ./voiceovers/concatenated.mp3`);
          resolve('./voiceovers/concatenated.mp3');
        } else {
          reject(new Error(`FFmpeg concat failed: ${error}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      });
    });
  } catch (error) {
    console.error(`❌ Concatenation failed: ${error.message}`);
    throw error;
  }
}

// ============ MAIN PIPELINE ============
export async function processVoiceovers(sceneJsonPath) {
  try {
    // Read scene JSON
    const sceneContent = await fs.readFile(sceneJsonPath, 'utf-8');
    const scene = JSON.parse(sceneContent);

    // Generate voiceovers
    const voiceovers = await generateAllVoiceovers(scene);

    if (voiceovers.length === 0) {
      console.log(`⚠️  No voiceovers were generated`);
      return null;
    }

    // Extract audio file paths
    const audioFiles = voiceovers.map(v => v.filePath);

    // Concatenate if multiple files
    const finalAudioPath = await concatenateAudioFiles(audioFiles);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ VOICEOVER PROCESSING COMPLETE`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      audioPath: finalAudioPath,
      voiceovers,
      totalDuration: voiceovers.reduce((sum, v) => sum + v.duration, 0)
    };
  } catch (error) {
    console.error(`❌ Voice processing pipeline failed: ${error.message}`);
    throw error;
  }
}