/**
 * Current tool pose in the machine frame, written each frame by the active module's tool
 * component and read by the machine structure (so the machine follows either module).
 */
export const toolPose = { x: 25, y: -6, zTip: 40, overhang: 45, ready: false };
