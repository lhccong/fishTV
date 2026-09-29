// 判断十六进制颜色（如 #RRGGBB / #RGB）是否属于“偏亮”的颜色。
// 用于在亮色主题下避免 VIP 选择的亮色（如金色、黄色）造成正文不可读。
export function isLightColor(color: string | undefined | null): boolean {
  if (!color) return true;
  const value = color.trim().replace('#', '');
  if (!value) return true;
  const expanded = value.length === 3
    ? value.split('').map(ch => ch + ch).join('')
    : value;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return true;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  // WCAG 相对亮度近似公式
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.55;
}

type ChatMessageLike = {
  color?: string;
  isPermanentVip?: boolean;
};

// 根据当前主题和消息自身信息，决定聊天室消息文本的样式。
// 规则：
// - 非 VIP 消息：始终使用主题默认色（避免服务端默认的 #FFFFFF 在亮色主题下不可见）。
// - VIP 消息且颜色偏亮 + 亮色主题：使用深色文字 + 颜色作为淡背景，保留 VIP 视觉效果。
// - VIP 消息且颜色偏亮 + 暗色主题：保持原色文字（暗色背景下亮色本身可读）。
// - VIP 消息但颜色偏深：保持原色文字 + 添加细微描边阴影，进一步增强可读性。
export function resolveChatMessageStyle(
  message: ChatMessageLike,
  isDarkMode: boolean,
): { style: React.CSSProperties; textColor: string; tintBackground: string | null } | null {
  if (!message.isPermanentVip || !message.color) return null;
  const color = message.color;
  const light = isLightColor(color);
  if (light && !isDarkMode) {
    // 亮色主题 + 亮色 VIP 颜色：用颜色作淡背景、深色文字，既保留 VIP 强调又可读。
    return {
      textColor: '#111827',
      tintBackground: `${color}26`,
      style: {
        color: '#111827',
        background: `${color}26`,
        borderColor: `${color}66`,
        boxShadow: 'none',
      },
    };
  }
  if (light && isDarkMode) {
    // 暗色主题 + 亮色：原色文字已经够亮，给一点描边阴影增强。
    return {
      textColor: color,
      tintBackground: `${color}1a`,
      style: {
        color,
        background: `${color}1a`,
        borderColor: `${color}33`,
        textShadow: '0 1px 2px rgba(0,0,0,.45)',
        boxShadow: 'none',
      },
    };
  }
  // 深色 VIP 颜色：双主题下都可读，给一个轻量的描边阴影即可。
  return {
    textColor: color,
    tintBackground: `${color}1a`,
    style: {
      color,
      background: `${color}1a`,
      borderColor: `${color}33`,
      boxShadow: 'none',
    },
  };
}
