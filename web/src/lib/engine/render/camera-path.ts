import { Matrix4, Quaternion, Vector3 } from 'three';

const BACK = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);

/** The camera as drawn. */
export interface CameraPose {
  quaternion: Quaternion;
  position: Vector3;
  target: Vector3;
}

/** Where a camera move is going. */
export interface CameraGoal {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}

export interface PathPose extends CameraPose {
  up: Vector3;
}

/** The orientation `lookAt` gives a camera at `eye` facing `target` with `up`. */
export function frameOf(eye: Vector3, target: Vector3, up: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, target, up));
}

/**
 * A camera move as an orbit. The camera's frame turns by the shortest rotation between its two
 * orientations while its distance and target are interpolated, so it swings round what it looks
 * at instead of cutting through it, and its roll turns with it rather than snapping first.
 *
 * `from` is the camera as drawn; `to` is where it is going. Returns the pose at eased progress
 * `t`; at 1, exactly `to`.
 */
export function orbitPath(from: CameraPose, to: CameraGoal): (t: number) => PathPose {
  // Copied: the caller goes on moving its own camera along the path.
  const start = from.quaternion.clone();
  const startTarget = from.target.clone();
  const end = frameOf(to.position, to.target, to.up);
  const startDistance = from.position.distanceTo(from.target);
  const endDistance = to.position.distanceTo(to.target);
  return (t) => {
    if (t >= 1) {
      return {
        quaternion: end.clone(),
        position: to.position.clone(),
        target: to.target.clone(),
        up: to.up.clone(),
      };
    }
    const quaternion = start.clone().slerp(end, t);
    const target = new Vector3().lerpVectors(startTarget, to.target, t);
    const distance = startDistance + (endDistance - startDistance) * t;
    return {
      quaternion,
      target,
      up: UP.clone().applyQuaternion(quaternion),
      position: BACK.clone().applyQuaternion(quaternion).multiplyScalar(distance).add(target),
    };
  };
}
