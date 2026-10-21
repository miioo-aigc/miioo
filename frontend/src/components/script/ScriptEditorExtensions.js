import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { Markdown } from 'tiptap-markdown';

/** 剧本与画布复用相同 Markdown 编辑能力，各实例独立创建扩展。 */
export function createScriptEditorExtensions() {
  return [
    Document, Paragraph, Text, Heading.configure({ levels: [1, 2] }), Bold,
    BulletList, OrderedList, ListItem,
    Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
  ];
}
