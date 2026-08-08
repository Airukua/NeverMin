import { execFile } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import type { ProviderName } from '../types';

const execFileAsync = promisify(execFile);

export type LocalLlmCapacityTier = 'weak' | 'moderate' | 'strong';

export interface LocalLlmCapacity {
  tier: LocalLlmCapacityTier;
  /** Berapa call completion lokal boleh jalan bersamaan. */
  maxConcurrentCalls: 1 | 2;
  /** Ukuran batch prompt ringkas-node (model kecil mudah gagal jika kebanyakan). */
  nodeSummaryBatchSize: number;
  cpuCores: number;
  totalMemGb: number;
  freeMemGb: number;
  hasGpu: boolean;
  gpuName?: string;
  gpuMemGb?: number;
  reason: string;
}

export interface LocalLlmRunPlan {
  capacity: LocalLlmCapacity;
  /** true = jangan Promise.all enrich. */
  sequential: boolean;
  nodeSummaryBatchSize: number;
}

interface GpuInfo {
  name: string;
  memGb: number;
}

function gb(bytes: number): number {
  return Math.round((bytes / (1024 ** 3)) * 10) / 10;
}

async function probeNvidiaGpu(timeoutMs = 2500): Promise<GpuInfo | null> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      { timeout: timeoutMs, windowsHide: true }
    );
    const line = stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find(Boolean);
    if (!line) {
      return null;
    }
    const parts = line.split(',').map((part) => part.trim());
    const name = parts[0] || 'NVIDIA GPU';
    const memMb = Number(parts[1]);
    if (!Number.isFinite(memMb) || memMb <= 0) {
      return { name, memGb: 0 };
    }
    return { name, memGb: Math.round((memMb / 1024) * 10) / 10 };
  } catch {
    return null;
  }
}

function scoreCpu(cores: number): number {
  if (cores >= 12) return 3;
  if (cores >= 6) return 2;
  return 1;
}

function scoreMem(freeMemGb: number, totalMemGb: number): number {
  if (freeMemGb >= 16 || totalMemGb >= 32) return 3;
  if (freeMemGb >= 8 || totalMemGb >= 16) return 2;
  return 1;
}

function scoreGpu(gpu: GpuInfo | null): number {
  if (!gpu) return 0;
  if (gpu.memGb >= 12) return 3;
  if (gpu.memGb >= 6) return 2;
  if (gpu.memGb > 0) return 1;
  return 1;
}

function tierFromScore(score: number): LocalLlmCapacityTier {
  if (score >= 3) return 'strong';
  if (score >= 2) return 'moderate';
  return 'weak';
}

/**
 * Ukur kapasitas mesin lokal untuk memutuskan concurrent call Ollama.
 * GPU via nvidia-smi (opsional); CPU/RAM selalu dihitung.
 */
export async function probeLocalLlmCapacity(): Promise<LocalLlmCapacity> {
  const cpuCores = Math.max(1, os.cpus()?.length || 1);
  const totalMemGb = gb(os.totalmem());
  const freeMemGb = gb(os.freemem());
  const gpu = await probeNvidiaGpu();

  const cpuScore = scoreCpu(cpuCores);
  const memScore = scoreMem(freeMemGb, totalMemGb);
  const gpuScore = scoreGpu(gpu);

  // Ambil kekuatan host: CPU/RAM sebagai dasar, GPU bisa menaikkan 1 tingkat.
  let score = Math.min(cpuScore, memScore);
  if (gpuScore >= 2) {
    score = Math.min(3, score + 1);
  } else if (gpuScore >= 1 && score === 1) {
    score = 2;
  }

  const tier = tierFromScore(score);
  const hasGpu = Boolean(gpu);
  const maxConcurrentCalls: 1 | 2 = tier === 'strong' && hasGpu && (gpu?.memGb ?? 0) >= 8 ? 2 : 1;
  const nodeSummaryBatchSize = tier === 'strong' ? 12 : tier === 'moderate' ? 8 : 5;

  const reasonParts = [
    `${cpuCores} CPU`,
    `RAM ${freeMemGb}/${totalMemGb} GB free/total`,
    hasGpu ? `GPU ${gpu?.name}${gpu?.memGb ? ` ${gpu.memGb}GB` : ''}` : 'no NVIDIA GPU',
    `tier=${tier}`,
    `concurrent=${maxConcurrentCalls}`,
    `batch=${nodeSummaryBatchSize}`
  ];

  return {
    tier,
    maxConcurrentCalls,
    nodeSummaryBatchSize,
    cpuCores,
    totalMemGb,
    freeMemGb,
    hasGpu,
    gpuName: gpu?.name,
    gpuMemGb: gpu?.memGb,
    reason: reasonParts.join(' · ')
  };
}

/** Rencana eksekusi enrich LLM berdasarkan provider + kapasitas host. */
export async function planLocalLlmRun(provider: ProviderName): Promise<LocalLlmRunPlan> {
  if (provider !== 'ollama') {
    return {
      capacity: {
        tier: 'strong',
        maxConcurrentCalls: 2,
        nodeSummaryBatchSize: 24,
        cpuCores: Math.max(1, os.cpus()?.length || 1),
        totalMemGb: gb(os.totalmem()),
        freeMemGb: gb(os.freemem()),
        hasGpu: false,
        reason: 'cloud provider · parallel ok'
      },
      sequential: false,
      nodeSummaryBatchSize: 24
    };
  }

  const capacity = await probeLocalLlmCapacity();
  return {
    capacity,
    // Ollama: paralel hanya jika host kuat + GPU memadai; selain itu sequential.
    sequential: capacity.maxConcurrentCalls < 2,
    nodeSummaryBatchSize: capacity.nodeSummaryBatchSize
  };
}
