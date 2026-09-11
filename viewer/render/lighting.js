import { DirectionalLight, Group, HemisphereLight, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** A soft studio environment plus lights that keep shape legible while orbiting. */
export function createAnatomicalLighting(renderer, camera, settings) {
  const room = new RoomEnvironment();
  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.04);
  room.dispose();
  generator.dispose();

  const rig = new Group();
  rig.add(new HemisphereLight(0xffffff, 0x777777, settings.hemisphere));
  const lights = [
    [0xffffff, settings.key, [-1.5, 2, 1]],
    [0xffffff, settings.fill, [2, 0.3, 0.5]],
    [0xffffff, settings.rim, [0.4, 1, -2]],
  ];
  for (const [color, intensity, position] of lights) {
    const light = new DirectionalLight(color, intensity);
    light.position.fromArray(position);
    light.target.position.set(0, 0, -1);
    rig.add(light, light.target);
  }
  camera.add(rig);
  return {
    texture: environment.texture,
    dispose() {
      rig.removeFromParent();
      environment.dispose();
    },
  };
}
