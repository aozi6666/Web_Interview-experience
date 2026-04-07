export function buildEffectObjectMaterialLoadPaths(
  effectFile: string,
  materialPath: string,
): { filePath: string; fallbackPaths: string[] } {
  const normalizedMaterialPath = materialPath.replace(/^\/+/, '');
  const effectDir = effectFile.replace(/[^/]+$/, '');
  const useProjectRootMaterial = normalizedMaterialPath.startsWith('materials/');
  const filePath = useProjectRootMaterial
    ? normalizedMaterialPath
    : `${effectDir}${normalizedMaterialPath}`;
  const fallbackPaths = [
    `/assets/${effectDir}${normalizedMaterialPath}`,
    `/assets/${normalizedMaterialPath}`,
  ];
  return { filePath, fallbackPaths };
}
