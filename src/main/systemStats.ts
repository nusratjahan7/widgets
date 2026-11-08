import os from 'node:os';
import { readFile, statfs } from 'node:fs/promises';
import type { SystemStats } from '../shared/types.js';

interface CpuSample {
  idle: number;
  total: number;
}

function sampleCpu(): CpuSample {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

let previous = sampleCpu();

/** Percentage of memory in use, using MemAvailable so caches don't inflate it. */
async function memoryUsage(): Promise<number> {
  try {
    const info = await readFile('/proc/meminfo', 'utf8');
    const total = Number(/MemTotal:\s+(\d+)/.exec(info)?.[1]);
    const available = Number(/MemAvailable:\s+(\d+)/.exec(info)?.[1]);
    if (total > 0 && available >= 0) return Math.round((1 - available / total) * 100);
  } catch {
    // not Linux: fall back to os accounting
  }
  return Math.round((1 - os.freemem() / os.totalmem()) * 100);
}

async function diskUsage(): Promise<number> {
  try {
    const stats = await statfs('/');
    const used = Number(stats.blocks - stats.bfree);
    const usable = used + Number(stats.bavail);
    return usable > 0 ? Math.round((used / usable) * 100) : 0;
  } catch {
    return 0;
  }
}

export async function sampleSystemStats(): Promise<SystemStats> {
  const current = sampleCpu();
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  previous = current;

  const cpu = totalDelta > 0 ? Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100))) : 0;
  const [memory, disk] = await Promise.all([memoryUsage(), diskUsage()]);
  return { cpu, memory, disk };
}
