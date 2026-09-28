import { useState } from 'react';
import { HiChat, HiLogout, HiUserGroup } from 'react-icons/hi';
import type { RoomChatMessage, RoomSummary } from '../hooks/useRoomSocket';

type RoomPanelProps = {
  room: RoomSummary | null;
  messages: RoomChatMessage[];
  connected: boolean;
  error: string;
  leaveRoom: () => Promise<{ success: boolean; error?: string }>;
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
};

export default function RoomPanel({
  room, messages, connected, error, leaveRoom, sendChat,
}: RoomPanelProps) {
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');

  const submitChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    const response = await sendChat(text);
    if (response.success) setText('');
    else setNotice(response.error || '发送失败');
  };

  if (!room) return null;
  return (
    <section className="mt-4 grid min-w-0 gap-4 border-t py-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <HiUserGroup className="h-5 w-5 text-red-500" />
            <strong className="truncate">{room.name}</strong>
          </div>
          <button type="button" disabled={!connected} onClick={async () => { const result = await leaveRoom(); if (!result.success) setNotice(result.error || '退出失败'); }} className="p-1 text-gray-400 hover:text-red-500" aria-label="退出房间"><HiLogout /></button>
        </div>
        <p className="mb-2 text-xs text-gray-500">房间号：{room.id} · {room.memberCount} 人</p>
        <ul className="space-y-1 text-sm text-gray-600">
          {room.members.map((member) => <li key={member.id} className="flex items-center gap-2 truncate">{member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <HiUserGroup className="h-5 w-5" />}<span className="truncate">{member.username}</span>{member.id === room.ownerId && <span className="text-xs text-red-500">房主</span>}</li>)}
        </ul>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><HiChat /> 聊天</div>
        <div className="mb-2 h-32 overflow-y-auto rounded bg-gray-50 p-2 text-sm">
          {messages.length ? messages.map((message) => <p key={message.id} className="mb-1 break-words"><span className="font-medium text-gray-700">{message.username}：</span>{message.text}</p>) : <p className="text-gray-400">还没有消息</p>}
        </div>
        <form onSubmit={submitChat} className="flex gap-2">
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="说点什么..." className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" />
          <button type="submit" disabled={!connected} className="rounded bg-red-500 px-4 py-2 text-sm text-white disabled:opacity-50">发送</button>
        </form>
        {(notice || error) && <p role="alert" className="mt-1 text-sm text-red-500">{notice || error}</p>}
      </div>
    </section>
  );
}
