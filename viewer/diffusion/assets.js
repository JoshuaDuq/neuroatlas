export async function readDiffusionAsset(file) {
  const url = `${import.meta.env.BASE_URL}diffusion/${file}`;
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new Error(`Could not fetch ${file}: ${error.message}`, { cause: error });
  }
  if (!response.ok) throw new Error(`Could not load ${file} (HTTP ${response.status}).`);
  return { url, buffer: await response.arrayBuffer() };
}
