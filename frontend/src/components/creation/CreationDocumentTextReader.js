const SUPPORTED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.txt', '.html'];

function getFileExtension(fileName = '') {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function normalizeDocumentText(text = '') {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/[ ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readHtmlText(file) {
  const html = await file.text();
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  documentNode.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
  return documentNode.body?.innerText || documentNode.body?.textContent || '';
}

async function readDocxText(file) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function readPdfText(file) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(' '));
  }
  return pageTexts.join('\n');
}

export async function readCreationDocumentText(file) {
  const extension = getFileExtension(file?.name);
  if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension)) {
    throw new Error('仅支持 PDF、DOCX、TXT、HTML 格式的文件');
  }

  let text;
  if (extension === '.txt') text = await file.text();
  else if (extension === '.html') text = await readHtmlText(file);
  else if (extension === '.docx') text = await readDocxText(file);
  else text = await readPdfText(file);

  const normalizedText = normalizeDocumentText(text);
  if (!normalizedText) throw new Error('未能从文件中读取到文字内容');
  return normalizedText;
}

