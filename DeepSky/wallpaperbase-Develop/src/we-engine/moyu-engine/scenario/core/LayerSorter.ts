import type { Layer } from '../layers/Layer';

export function sortLayersWithDependencies(
  layers: Layer[],
  dependencies: Map<string, string[]>,
): Layer[] {
  if (dependencies.size === 0) {
    return layers.sort((a, b) => a.zIndex - b.zIndex);
  }
  const sorted: Layer[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  const visit = (layer: Layer) => {
    if (visited.has(layer.id)) return;
    if (visiting.has(layer.id)) return;
    visiting.add(layer.id);
    const deps = dependencies.get(layer.id) || [];
    for (const depId of deps) {
      const depLayer = layerMap.get(depId);
      if (depLayer) visit(depLayer);
    }
    visiting.delete(layer.id);
    visited.add(layer.id);
    sorted.push(layer);
  };

  layers.sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of layers) {
    visit(layer);
  }
  return sorted;
}
