import { HiOutlineChevronUp } from 'react-icons/hi';
import { PLAYBACK_RATES } from '../../shared/roomPlayback';
import RoomPlayerMenu from './RoomPlayerMenu';

const options = PLAYBACK_RATES.map(value => ({ value, label: `${value}×` }));

type Props = {
  rate: number;
  canChange: boolean;
  connected: boolean;
  busy: boolean;
  onChange: (rate: number) => void;
};

export default function RoomPlaybackRate({ rate, canChange, connected, busy, onChange }: Props) {
  return <RoomPlayerMenu value={rate} options={options} label={`播放倍速 ${rate}×`}
    tooltip={canChange ? '播放倍速（全员同步）' : '播放倍速（由房主调整）'}
    canChange={canChange} connected={connected} busy={busy} onChange={onChange}>
    <span>{rate}×</span><HiOutlineChevronUp aria-hidden="true" />
  </RoomPlayerMenu>;
}
