import { dialog } from 'electron';

export async function openFileDialog(): Promise<string[] | false> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择动态壁纸',
    filters: [{ name: '视频', extensions: ['mp4', 'webm'] }],
  });

  if (!canceled) {
    return filePaths;
  }

  return false;
}
