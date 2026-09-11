/** Canvas rows run from superior/anterior to inferior/posterior. */
export function renderSlice(volumes, frame, display) {
  const { size, fieldOfView, windowCenter, windowWidth, overlay } = display;
  if (!Number.isInteger(size) || size < 2 || size > 2048 ||
      !Number.isFinite(fieldOfView) || fieldOfView <= 0 ||
      !Number.isFinite(windowCenter) || !Number.isFinite(windowWidth) || windowWidth <= 0) {
    throw new RangeError('Invalid slice resolution or MRI window.');
  }
  const pixels = new Uint8ClampedArray(size*size*4);
  const step = fieldOfView / size;
  const origin = frame.center.clone().addScaledVector(frame.u, -fieldOfView/2 + step/2)
    .addScaledVector(frame.v, fieldOfView/2 - step/2);
  const point = [0,0,0];
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    point[0] = origin.x + step*(x*frame.u.x - y*frame.v.x);
    point[1] = origin.y + step*(x*frame.u.y - y*frame.v.y);
    point[2] = origin.z + step*(x*frame.u.z - y*frame.v.z);
    const label = volumes.segmentation.nearest(point);
    const gray = Math.max(0, Math.min(255,
      (volumes.mri.linear(point) - windowCenter + windowWidth/2) * 255/windowWidth));
    const index = (y*size+x)*4;
    const color = overlay && label ? volumes.metadata.labels[label].color : null;
    for (let channel=0; channel<3; channel++) {
      pixels[index+channel] = color ? gray*.55 + color[channel]*.45 : gray;
    }
    pixels[index+3] = label ? 255 : 0;
  }
  return pixels;
}
