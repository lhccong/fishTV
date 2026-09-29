import { useId, useLayoutEffect, useRef, useState } from 'react';
import { HiOutlineAnnotation, HiCheck } from 'react-icons/hi';
import { MdColorLens, MdAutoAwesome } from 'react-icons/md';
import { HexColorPicker } from 'react-colorful';
import Tooltip from './Tooltip';
import type { DanmakuEffect } from '../hooks/useRoomSocket';

const VIP_PRESET_COLORS = [
  '#FFFFFF', '#FF0000', '#FF7F00', '#FFFF00', '#00FF00',
  '#00FFFF', '#0000FF', '#8B00FF', '#FF1493', '#FFD700',
];

const VIP_EFFECTS: { value: DanmakuEffect; label: string }[] = [
  { value: 'normal', label: '普通' },
  { value: 'rainbow', label: '彩虹' },
  { value: 'glow', label: '发光' },
  { value: 'shake', label: '抖动' },
  { value: 'wave', label: '波浪' },
  { value: 'zoom', label: '缩放' },
];

const FONT_SIZES = [
  { value: 12, label: '小' },
  { value: 14, label: '中' },
  { value: 16, label: '大' },
  { value: 18, label: '特大' },
];

type Props = {
  isVip: boolean;
  selectedColor: string;
  onColorChange: (color: string) => void;
  selectedEffect: DanmakuEffect;
  onEffectChange: (effect: DanmakuEffect) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
};

export default function RoomDanmakuSettings({
  isVip,
  selectedColor,
  onColorChange,
  selectedEffect,
  onEffectChange,
  fontSize,
  onFontSizeChange,
  opacity,
  onOpacityChange,
  speed,
  onSpeedChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState(400);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = () => { setOpen(false); trigger.current?.focus(); };

  useLayoutEffect(() => {
    if (!open) return;
    const player = root.current?.closest('.watch-video');
    const resize = () => {
      if (player && trigger.current) {
        setMaxHeight(Math.max(200, trigger.current.getBoundingClientRect().top - player.getBoundingClientRect().top - 16));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (player) observer.observe(player);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => { observer.disconnect(); document.removeEventListener('pointerdown', outside); };
  }, [open]);

  return <div ref={root} className="watch-danmaku-settings" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <Tooltip label="弹幕设置">
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        className="watch-danmaku-settings-trigger"
        aria-label="弹幕设置"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <HiOutlineAnnotation />
      </button>
    </Tooltip>
    {open && <div
      id={`${id}-panel`}
      className="watch-danmaku-settings-panel"
      role="dialog"
      aria-labelledby={`${id}-trigger`}
      style={{ maxHeight, width: 320, maxWidth: 320, minWidth: 0 }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="watch-danmaku-settings-content">
        <div className="watch-danmaku-settings-header-row">
          <strong>弹幕设置</strong>
        </div>
        
        {/* 通用设置（所有用户可用） */}
        <div className="watch-danmaku-setting-section">
          <div className="watch-danmaku-setting-header">
            <strong>字号</strong>
          </div>
          <div className="watch-effect-options-grid">
            {FONT_SIZES.map(size => (
              <button
                key={size.value}
                type="button"
                className={`watch-effect-option-btn ${fontSize === size.value ? 'active' : ''}`}
                onClick={() => onFontSizeChange(size.value)}
              >
                <span className="watch-effect-option-label">{size.label}</span>
                {fontSize === size.value && <HiCheck className="watch-effect-check" />}
              </button>
            ))}
          </div>
        </div>

        <div className="watch-danmaku-setting-divider" />

        {/* 透明度 */}
        <div className="watch-danmaku-setting-section">
          <div className="watch-danmaku-setting-header">
            <strong>透明度</strong>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <div className="watch-danmaku-slider-wrap">
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={e => onOpacityChange(parseFloat(e.target.value))}
              className="watch-danmaku-slider"
            />
          </div>
        </div>

        <div className="watch-danmaku-setting-divider" />

        {/* 速度 */}
        <div className="watch-danmaku-setting-section">
          <div className="watch-danmaku-setting-header">
            <strong>滑动速度</strong>
            <span>{speed === 8 ? '慢' : speed === 12 ? '中' : speed === 16 ? '快' : '超快'}</span>
          </div>
          <div className="watch-danmaku-slider-wrap">
            <input
              type="range"
              min="8"
              max="20"
              step="4"
              value={speed}
              onChange={e => onSpeedChange(parseInt(e.target.value))}
              className="watch-danmaku-slider"
            />
          </div>
        </div>

        <div className="watch-danmaku-setting-divider" />

        {/* VIP 专属设置 */}
        <div className="watch-danmaku-settings-header-row">
          <strong>专属装扮</strong>
        </div>
        {!isVip ? (
          <div className="watch-danmaku-setting-vip-hint">
            <p>开通永久 VIP 后可解锁自定义弹幕颜色与特效。</p>
          </div>
        ) : (<>
            {/* 弹幕预览 */}
            <div className="watch-danmaku-preview-stage">
              <div className="watch-danmaku-preview-label">效果预览</div>
              <div className="watch-danmaku-preview-track">
                <span className="watch-preview-bullet">
                  <span
                    className={`watch-preview-bullet-inner ${selectedEffect !== 'normal' ? `effect-${selectedEffect}` : ''}`}
                    style={{ 
                      color: selectedEffect === 'rainbow' ? undefined : selectedColor,
                      fontSize: `${fontSize}px`,
                      opacity
                    }}
                  >
                    <span className="watch-preview-title">【鱼乐无限】</span>
                    用户昵称：这是一条预览弹幕示例
                  </span>
                </span>
              </div>
            </div>

            <div className="watch-danmaku-setting-divider" />

            {/* 弹幕颜色 */}
            <div className="watch-danmaku-setting-section">
              <div className="watch-danmaku-setting-header">
                <MdColorLens />
                <strong>弹幕颜色</strong>
              </div>
              <div className="watch-preset-colors-grid">
                {VIP_PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`watch-color-preset-btn ${selectedColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => onColorChange(color)}
                  />
                ))}
              </div>
              <div className="watch-custom-color-section">
                <HexColorPicker color={selectedColor} onChange={onColorChange} />
              </div>
              <div className="watch-color-value">
                <span>当前：</span>
                <code>{selectedColor}</code>
              </div>
            </div>

            <div className="watch-danmaku-setting-divider" />

            {/* 弹幕特效 */}
            <div className="watch-danmaku-setting-section">
              <div className="watch-danmaku-setting-header">
                <MdAutoAwesome />
                <strong>弹幕特效</strong>
              </div>
              <div className="watch-effect-options-grid">
                {VIP_EFFECTS.map(effect => (
                  <button
                    key={effect.value}
                    type="button"
                    className={`watch-effect-option-btn ${selectedEffect === effect.value ? 'active' : ''}`}
                    onClick={() => onEffectChange(effect.value)}
                  >
                    <span className="watch-effect-option-label">{effect.label}</span>
                    {selectedEffect === effect.value && <HiCheck className="watch-effect-check" />}
                  </button>
                ))}
              </div>
            </div>
          </>)}
      </div>
    </div>}
  </div>;
}
