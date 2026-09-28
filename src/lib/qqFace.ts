import manifest from './qqFaces.json';

export const QQ_FACES = manifest.map(face => ({ id: face.id, label: face.text.replace(/^\//, '') || `表情 ${face.id}` }));
const faces = new Map(QQ_FACES.map(face => [face.id, face]));
export const getQQFace = (id: string) => faces.get(id);
export const qqFaceToken = (id: string) => `[qqface:${id}]`;
export const qqFaceUrl = (id: string) => `${import.meta.env.BASE_URL}qface/${id}.apng`;
export type ChatPart = string | { id: string; label: string };

export function parseChatText(text: string): ChatPart[] {
  const parts: ChatPart[] = [];
  let start = 0;
  for (const match of text.matchAll(/\[qqface:(\d{1,4})\]/g)) {
    const face = getQQFace(match[1]);
    if (!face) continue;
    if (match.index! > start) parts.push(text.slice(start, match.index));
    parts.push(face);
    start = match.index! + match[0].length;
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}

// Images count as one visible item, while their serialized tokens retain the chat limit.
export function clipChatText(text: string, limit: number): string {
  let result = '', count = 0;
  for (const part of parseChatText(text)) {
    const items = typeof part === 'string' ? Array.from(part) : [qqFaceToken(part.id)];
    for (const item of items) {
      if (count++ >= limit) return `${result}…`;
      result += item;
    }
  }
  return result;
}

export function readChatEditor(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node instanceof HTMLImageElement) {
    const id = node.dataset.qqFaceId || '';
    return getQQFace(id) ? qqFaceToken(id) : node.alt;
  }
  if (node instanceof HTMLElement && node.tagName === 'BR') return '\n';
  return Array.from(node.childNodes).map(readChatEditor).join('');
}

export function chatFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const part of parseChatText(text)) {
    if (typeof part === 'string') fragment.append(document.createTextNode(part));
    else {
      const image = document.createElement('img');
      image.src = qqFaceUrl(part.id);
      image.alt = `[${part.label}]`;
      image.dataset.qqFaceId = part.id;
      image.contentEditable = 'false';
      image.draggable = false;
      image.className = 'watch-qqface';
      fragment.append(image);
    }
  }
  return fragment;
}
