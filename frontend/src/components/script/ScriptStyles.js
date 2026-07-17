const EDITOR_STYLE_ID = 'script-editor-style';

export function ensureScriptEditorStyle() {
  if (document.getElementById(EDITOR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = EDITOR_STYLE_ID;
  style.textContent = `
    .tiptap-editor .ProseMirror {
      outline: none;
      caret-color: #2DC3E1;
    }
    .tiptap-editor .ProseMirror h1 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 20px;
      line-height: 24px;
      font-weight: bold;
      margin: 0 0 8px;
    }
    .tiptap-editor .ProseMirror h2 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 16px;
      line-height: 20px;
      font-weight: bold;
      margin: 12px 0 6px;
    }
    .tiptap-editor .ProseMirror p {
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .tiptap-editor .ProseMirror strong {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_65_Medium', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
    }
    .tiptap-editor .ProseMirror ul,
    .tiptap-editor .ProseMirror ol {
      padding-left: 20px;
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .tiptap-editor .ProseMirror li { margin: 2px 0; }
    .tiptap-editor .ProseMirror li p { margin: 0; }
    .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
      color: #FFFFFF33;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
    .script-md {
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      padding-right: 4px;
      scroll-behavior: smooth;
    }
    .script-md h1 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 20px;
      line-height: 24px;
      font-weight: bold;
      margin: 0 0 8px;
    }
    .script-md h2 {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_85_Bold', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 16px;
      line-height: 20px;
      font-weight: bold;
      margin: 12px 0 6px;
      scroll-margin-top: 20px;
    }
    .script-md p {
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .script-md strong {
      color: #FFFFFF;
      font-family: 'AlibabaPuHuiTi_2_65_Medium', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
    }
    .script-md ul,
    .script-md ol {
      padding-left: 20px;
      color: #FFFFFFCC;
      font-family: 'AlibabaPuHuiTi_2_55_Regular', 'Alibaba_PuHuiTi_2.0', system-ui, sans-serif;
      font-size: 14px;
      line-height: 150%;
      margin: 4px 0;
    }
    .script-md li { margin: 2px 0; }
  `;
  document.head.appendChild(style);
}
