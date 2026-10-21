import { Mark, Node, mergeAttributes } from '@tiptap/core';
import { createScriptEditorExtensions } from '../script/ScriptEditorExtensions';

// 补齐预览支持的常见格式，避免修改一处正文时丢失其他位置的格式。
const Italic = Mark.create({
  name: 'italic', parseHTML: () => [{ tag: 'em' }, { tag: 'i' }],
  renderHTML: ({ HTMLAttributes }) => ['em', HTMLAttributes, 0],
});
const Code = Mark.create({
  name: 'code', code: true, excludes: '_',
  parseHTML: () => [{ tag: 'code' }], renderHTML: ({ HTMLAttributes }) => ['code', HTMLAttributes, 0],
});
const Link = Mark.create({
  name: 'link', inclusive: false,
  addAttributes: () => ({ href: { default: null }, title: { default: null } }),
  parseHTML: () => [{ tag: 'a[href]' }],
  renderHTML: ({ HTMLAttributes }) => ['a', mergeAttributes(HTMLAttributes, { rel: 'noopener noreferrer' }), 0],
});
const Blockquote = Node.create({
  name: 'blockquote', group: 'block', content: 'block+', defining: true,
  parseHTML: () => [{ tag: 'blockquote' }], renderHTML: ({ HTMLAttributes }) => ['blockquote', HTMLAttributes, 0],
});
const CodeBlock = Node.create({
  name: 'codeBlock', group: 'block', content: 'text*', marks: '', code: true, defining: true,
  addAttributes: () => ({ language: { default: null, parseHTML: (element) => element.firstElementChild?.className.match(/language-([^ ]+)/)?.[1] || null, rendered: false } }),
  parseHTML: () => [{ tag: 'pre', preserveWhitespace: 'full' }],
  renderHTML: ({ node, HTMLAttributes }) => ['pre', HTMLAttributes, ['code', node.attrs.language ? { class: `language-${node.attrs.language}` } : {}, 0]],
});
const HardBreak = Node.create({
  name: 'hardBreak', inline: true, group: 'inline', selectable: false,
  parseHTML: () => [{ tag: 'br' }], renderHTML: () => ['br'],
  addKeyboardShortcuts() { return { 'Shift-Enter': () => this.editor.commands.insertContent({ type: this.name }) }; },
});
const HorizontalRule = Node.create({
  name: 'horizontalRule', group: 'block',
  parseHTML: () => [{ tag: 'hr' }], renderHTML: () => ['hr'],
});
const Image = Node.create({
  name: 'image', inline: true, group: 'inline', atom: true,
  addAttributes: () => ({ src: { default: null }, alt: { default: null }, title: { default: null } }),
  parseHTML: () => [{ tag: 'img[src]' }], renderHTML: ({ HTMLAttributes }) => ['img', HTMLAttributes],
});
export function createCanvasTextEditorExtensions() {
  return [
    ...createScriptEditorExtensions().map((extension) => extension.name === 'heading'
      ? extension.configure({ levels: [1, 2, 3, 4, 5, 6] }) : extension),
    Italic, Code, Link, Blockquote, CodeBlock, HardBreak, HorizontalRule, Image,
  ];
}
