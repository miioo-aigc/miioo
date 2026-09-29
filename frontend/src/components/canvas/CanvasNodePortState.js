export function getCanvasPortClassName({ cardHovered = false, portHovered = false, connecting = false, nodeActive = false } = {}) {
  const visible = cardHovered || portHovered || connecting || nodeActive;
  const enlarged = portHovered || connecting;
  return [
    'canvas-node__port',
    visible && 'canvas-node__port--visible',
    enlarged && 'canvas-node__port--enlarged',
    connecting && 'canvas-node__port--active',
  ].filter(Boolean).join(' ');
}
