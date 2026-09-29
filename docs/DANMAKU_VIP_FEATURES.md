# 弹幕颜色和特效功能方案

## 1. 功能概述

根据用户 VIP 状态，提供差异化的弹幕发送功能：
- **VIP 用户**：可自定义弹幕颜色和特效
- **普通用户**：使用默认白色弹幕，无特效

## 2. 数据结构

### 2.1 用户信息（已实现）

从摸鱼岛 OAuth 获取并保存的用户信息：
```typescript
type Profile = { 
  id: string; 
  username: string; 
  avatarUrl?: string;
  isPermanentVip?: boolean;      // VIP 状态
  donationAmount?: number;        // 捐赠金额
  currentTitleName?: string;      // 当前称号
};
```

### 2.2 弹幕消息结构（需扩展）

当前弹幕消息需要扩展以支持颜色和特效：
```typescript
interface DanmakuMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  timestamp: number;
  
  // 新增字段
  color?: string;           // 弹幕颜色（十六进制，如 #FF0000）
  effect?: DanmakuEffect;   // 弹幕特效
  isPermanentVip?: boolean; // VIP 标识（用于显示 VIP 徽章）
  titleName?: string;       // 称号（用于显示）
}

type DanmakuEffect = 
  | 'normal'      // 普通（默认）
  | 'rainbow'     // 彩虹渐变
  | 'glow'        // 发光效果
  | 'shake'       // 抖动效果
  | 'wave'        // 波浪效果
  | 'zoom'        // 缩放动画
  | 'slide';      // 滑动进入
```

## 3. 前端实现

### 3.1 弹幕输入组件（RoomChatComposer）

#### 3.1.1 VIP 用户功能增强

在弹幕输入框旁边添加：
- **颜色选择器**：仅 VIP 可见，提供常用颜色快捷选择 + 自定义颜色选择器
- **特效选择器**：仅 VIP 可见，下拉或弹窗选择特效类型
- **预览功能**：实时预览弹幕效果

```typescript
// 预设颜色
const VIP_PRESET_COLORS = [
  '#FFFFFF', // 白色（默认）
  '#FF0000', // 红色
  '#FF7F00', // 橙色
  '#FFFF00', // 黄色
  '#00FF00', // 绿色
  '#00FFFF', // 青色
  '#0000FF', // 蓝色
  '#8B00FF', // 紫色
  '#FF1493', // 粉色
  '#FFD700', // 金色
];

// 特效选项
const VIP_EFFECTS = [
  { value: 'normal', label: '普通', preview: '正常显示' },
  { value: 'rainbow', label: '彩虹', preview: '渐变色彩' },
  { value: 'glow', label: '发光', preview: '光晕效果' },
  { value: 'shake', label: '抖动', preview: '轻微抖动' },
  { value: 'wave', label: '波浪', preview: '波浪起伏' },
  { value: 'zoom', label: '缩放', preview: '放大显示' },
  { value: 'slide', label: '滑入', preview: '滑动进入' },
];
```

#### 3.1.2 UI 布局建议

```
┌─────────────────────────────────────────────────────┐
│ [颜色] [特效] [表情] [输入框................] [发送] │
│   ↑      ↑                                           │
│   │      └─ 仅 VIP 可见                              │
│   └─ 仅 VIP 可见                                     │
└─────────────────────────────────────────────────────┘
```

#### 3.1.3 状态管理

```typescript
const [selectedColor, setSelectedColor] = useState('#FFFFFF');
const [selectedEffect, setSelectedEffect] = useState<DanmakuEffect>('normal');
const [showColorPicker, setShowColorPicker] = useState(false);
const [showEffectSelector, setShowEffectSelector] = useState(false);

// 从用户 session 获取 VIP 状态
const { user } = useAuth(); // 或从现有的用户状态管理中获取
const isVip = user?.isPermanentVip || false;
```

### 3.2 弹幕发送逻辑

#### 3.2.1 客户端发送

```typescript
// 发送弹幕时携带颜色和特效信息
socket.emit('chat:message', {
  content: messageText,
  color: isVip ? selectedColor : '#FFFFFF',
  effect: isVip ? selectedEffect : 'normal',
});
```

#### 3.2.2 服务端验证（重要）

在 `server/socket.ts` 中验证 VIP 权限，防止非 VIP 用户伪造请求：

```typescript
socket.on('chat:message', async (data, callback) => {
  const session = socket.data.session;
  const isVip = session.profile.isPermanentVip || false;
  
  // 非 VIP 用户强制使用默认样式
  const color = isVip && isValidColor(data.color) ? data.color : '#FFFFFF';
  const effect = isVip && isValidEffect(data.effect) ? data.effect : 'normal';
  
  const message = {
    id: generateId(),
    userId: session.profile.id,
    username: session.profile.username,
    avatarUrl: session.profile.avatarUrl,
    content: sanitize(data.content),
    timestamp: Date.now(),
    color,
    effect,
    isPermanentVip: isVip,
    titleName: session.profile.currentTitleName,
  };
  
  // 广播给房间内所有用户
  io.to(roomId).emit('chat:message', message);
});

// 辅助函数：验证颜色
function isValidColor(color: any): boolean {
  return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

// 辅助函数：验证特效
function isValidEffect(effect: any): boolean {
  const validEffects = ['normal', 'rainbow', 'glow', 'shake', 'wave', 'zoom', 'slide'];
  return validEffects.includes(effect);
}
```

### 3.3 弹幕显示组件（RoomPlayerChat）

#### 3.3.1 样式应用

根据弹幕消息的 `color` 和 `effect` 字段应用样式：

```typescript
<div 
  className={`chat-message ${message.effect !== 'normal' ? `effect-${message.effect}` : ''}`}
  style={{ color: message.color }}
>
  {/* VIP 徽章 */}
  {message.isPermanentVip && <VipBadge />}
  
  {/* 称号 */}
  {message.titleName && (
    <span className="user-title">[{message.titleName}]</span>
  )}
  
  {/* 用户名 */}
  <span className="username">{message.username}:</span>
  
  {/* 弹幕内容 */}
  <span className="message-content">{message.content}</span>
</div>
```

#### 3.3.2 CSS 特效实现

在 `watch-room.css` 中添加特效样式：

```css
/* 彩虹渐变效果 */
.chat-message.effect-rainbow .message-content {
  background: linear-gradient(90deg, 
    #ff0000, #ff7f00, #ffff00, #00ff00, 
    #0000ff, #4b0082, #8b00ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% 100%;
  animation: rainbow-slide 3s linear infinite;
}

@keyframes rainbow-slide {
  to { background-position: -200% 0; }
}

/* 发光效果 */
.chat-message.effect-glow .message-content {
  text-shadow: 
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 30px currentColor;
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { text-shadow: 0 0 10px currentColor; }
  50% { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
}

/* 抖动效果 */
.chat-message.effect-shake .message-content {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px) rotate(-0.5deg); }
  75% { transform: translateX(2px) rotate(0.5deg); }
}

/* 波浪效果 */
.chat-message.effect-wave .message-content {
  display: inline-block;
  animation: wave 1.5s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-3px); }
  75% { transform: translateY(3px); }
}

/* 缩放效果 */
.chat-message.effect-zoom .message-content {
  display: inline-block;
  animation: zoom-in 0.5s ease-out;
  font-size: 1.1em;
  font-weight: bold;
}

@keyframes zoom-in {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 滑入效果 */
.chat-message.effect-slide {
  animation: slide-in 0.5s ease-out;
}

@keyframes slide-in {
  from { transform: translateX(-50px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* VIP 徽章样式 */
.vip-badge {
  display: inline-block;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #333;
  font-size: 0.75em;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 4px;
  vertical-align: middle;
}

/* 称号样式 */
.user-title {
  display: inline-block;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.85em;
  margin-right: 4px;
  color: #ffd700;
}
```

## 4. 用户体验优化

### 4.1 颜色选择器 UI

使用流行的颜色选择器库（如 `react-colorful`）：

```bash
npm install react-colorful
```

```typescript
import { HexColorPicker } from 'react-colorful';

{isVip && showColorPicker && (
  <div className="color-picker-popup">
    <div className="preset-colors">
      {VIP_PRESET_COLORS.map(color => (
        <button
          key={color}
          className="color-preset"
          style={{ backgroundColor: color }}
          onClick={() => setSelectedColor(color)}
        />
      ))}
    </div>
    <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
  </div>
)}
```

### 4.2 特效选择器 UI

使用下拉菜单或网格选择：

```typescript
{isVip && showEffectSelector && (
  <div className="effect-selector-popup">
    {VIP_EFFECTS.map(effect => (
      <button
        key={effect.value}
        className={`effect-option ${selectedEffect === effect.value ? 'active' : ''}`}
        onClick={() => setSelectedEffect(effect.value)}
      >
        <span className="effect-label">{effect.label}</span>
        <span className="effect-preview">{effect.preview}</span>
      </button>
    ))}
  </div>
)}
```

### 4.3 实时预览

在输入框下方显示弹幕效果预览：

```typescript
{isVip && messageText && (
  <div className="danmaku-preview">
    <span className="preview-label">预览：</span>
    <div 
      className={`preview-message effect-${selectedEffect}`}
      style={{ color: selectedColor }}
    >
      {messageText}
    </div>
  </div>
)}
```

### 4.4 非 VIP 用户提示

普通用户尝试访问 VIP 功能时显示提示：

```typescript
{!isVip && (
  <div className="vip-feature-hint">
    <span>💎 自定义弹幕颜色和特效是 VIP 专属功能</span>
    <button onClick={() => window.open('https://yucoder.cn/vip', '_blank')}>
      成为 VIP
    </button>
  </div>
)}
```

## 5. 性能考虑

### 5.1 特效节流

对于 CPU 密集型特效（如彩虹、发光），限制同屏显示数量：

```typescript
const MAX_EFFECT_MESSAGES = 10; // 同时最多 10 条特效弹幕

// 超过限制时，旧的特效弹幕降级为普通样式
```

### 5.2 动画优化

使用 CSS `transform` 和 `opacity` 而非 `left`/`top` 等属性，确保 GPU 加速。

### 5.3 移动端适配

在移动设备上简化或禁用复杂特效：

```typescript
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
const effectEnabled = !isMobile || selectedEffect === 'normal';
```

## 6. 实现优先级

1. **Phase 1（核心功能）**
   - [ ] 服务端保存 VIP 信息（✅ 已完成）
   - [ ] 客户端获取用户 VIP 状态
   - [ ] VIP 颜色选择器（预设颜色）
   - [ ] 弹幕颜色显示
   - [ ] 服务端权限验证

2. **Phase 2（特效功能）**
   - [ ] 特效选择器 UI
   - [ ] 基础特效实现（发光、抖动、缩放）
   - [ ] VIP 徽章显示
   - [ ] 称号显示

3. **Phase 3（体验优化）**
   - [ ] 自定义颜色选择器
   - [ ] 高级特效（彩虹、波浪、滑入）
   - [ ] 实时预览功能
   - [ ] 移动端适配

4. **Phase 4（增强功能）**
   - [ ] 用户颜色和特效偏好保存（localStorage）
   - [ ] 特效音效（可选）
   - [ ] 管理员屏蔽过于刺眼的颜色组合
   - [ ] 弹幕特效开关（用户可关闭他人特效）

## 7. 相关文件

需要修改的文件：
- `server/userAuth.ts` - ✅ 已更新 VIP 信息保存
- `server/socket.ts` - Socket 消息处理和权限验证
- `src/components/RoomChatComposer.tsx` - 弹幕输入和选择器
- `src/components/RoomPlayerChat.tsx` - 弹幕显示和特效
- `src/watch-room.css` - 特效样式定义
- `shared/types.ts` - 共享类型定义（如需要）

## 8. 测试要点

- [ ] VIP 用户可以选择颜色和特效
- [ ] 普通用户只能发送白色普通弹幕
- [ ] 服务端正确验证权限，防止伪造
- [ ] 特效不影响性能（60fps）
- [ ] 颜色对比度足够（可读性）
- [ ] 移动端正常显示
- [ ] VIP 徽章和称号正确显示
