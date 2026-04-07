/**
 * 版本号比对工具
 * 支持语义化版本号（Semantic Versioning）格式：major.minor.patch
 * 例如：1.2.3, 0.10.5, 2.0.0
 */

/**
 * 解析版本号字符串为数字数组
 * @param version 版本号字符串，如 "1.2.3"
 * @returns 版本号数字数组，如 [1, 2, 3]
 */
function parseVersion(version: string): number[] {
  // 移除前缀 'v' 或 'V'（如果存在）
  const cleanVersion = version.replace(/^[vV]/, '');

  // 分割版本号并转换为数字
  return cleanVersion.split('.').map((part) => {
    const num = parseInt(part, 10);
    return Number.isNaN(num) ? 0 : num;
  });
}

/**
 * 比较两个版本号
 * @param version1 版本号1
 * @param version2 版本号2
 * @returns
 *  - 1: version1 > version2
 *  - 0: version1 === version2
 *  - -1: version1 < version2
 */
export function compareVersions(version1: string, version2: string): number {
  const v1Parts = parseVersion(version1);
  const v2Parts = parseVersion(version2);

  // 确保两个版本号数组长度一致（补0）
  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) {
      return 1;
    }
    if (v1Part < v2Part) {
      return -1;
    }
  }

  return 0;
}

/**
 * 检查是否有新版本
 * @param currentVersion 当前版本号
 * @param latestVersion 最新版本号
 * @returns true: 有新版本，false: 没有新版本
 */
export function hasNewVersion(
  currentVersion: string,
  latestVersion: string,
): boolean {
  return compareVersions(latestVersion, currentVersion) > 0;
}

/**
 * 检查版本号是否有效
 * @param version 版本号字符串
 * @returns true: 有效，false: 无效
 */
export function isValidVersion(version: string): boolean {
  if (!version || typeof version !== 'string') {
    return false;
  }

  // 移除前缀 'v' 或 'V'
  const cleanVersion = version.replace(/^[vV]/, '');

  // 检查格式是否为 x.y.z（可以有更多部分，但至少要有一个数字）
  const versionRegex = /^\d+(\.\d+)*$/;
  return versionRegex.test(cleanVersion);
}

/**
 * 格式化版本号（移除前缀 v/V）
 * @param version 版本号字符串
 * @returns 格式化后的版本号
 */
export function formatVersion(version: string): string {
  return version.replace(/^[vV]/, '');
}
