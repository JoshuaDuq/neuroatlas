export async function decodeTractAsset(buffer) {
  const { NVMeshLoaders } = await import('@niivue/niivue');
  return NVMeshLoaders.readTRK(buffer);
}
