const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];

function getExtension(fileName = '') {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex < 0 ? '' : fileName.slice(dotIndex).toLowerCase();
}

export async function readCanvasTextFile(file) {
  const extension = getExtension(file?.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) throw new Error('仅支持 .docx/.txt/.md 格式的文件');
  if (extension !== '.docx') return file.text();

  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}
