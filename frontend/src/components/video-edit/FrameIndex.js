export function orderedFrameTimes(packets) {
  return [...new Set(packets.map((packet) => packet.timestamp).filter(Number.isFinite))].sort((a, b) => a - b);
}

export function frameAtTime(times, time) {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (times[middle] <= time) low = middle;
    else high = middle - 1;
  }
  return low;
}
