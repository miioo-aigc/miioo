export const CANVAS_CARD_PULSE_DURATION = 600;

export function getCanvasPulseTiming(edgeLength, cardLength) {
  if (![edgeLength, cardLength].every((length) => Number.isFinite(length) && length > 0)) return null;
  const speed = cardLength / CANVAS_CARD_PULSE_DURATION;
  return { speed, edgeDuration: edgeLength / speed };
}

export function getCanvasPulseTravel(pathLength, tailPercent, speed) {
  const tailLength = pathLength * tailPercent / 100;
  return { tailLength, from: tailLength, to: tailLength - pathLength, duration: pathLength / speed };
}
