import { useState } from 'react';
import { HiUserGroup } from 'react-icons/hi';
import type { RoomMember, RoomSummary } from '../hooks/useRoomSocket';

function MemberAvatar({ member }: { member: RoomMember }) {
  const [failed, setFailed] = useState(false);
  return <span className="watch-member-avatar" aria-hidden="true">
    {member.avatarUrl && !failed
      ? <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span>{Array.from(member.username.trim())[0] || '?'}</span>}
  </span>;
}

export default function RoomMembers({ room, userId, open, onOpenChange }: {
  room: RoomSummary; userId?: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const members = [...room.members].sort((a, b) => {
    const rank = (member: RoomMember) => member.id === userId ? 0 : member.id === room.ownerId ? 1 : 2;
    return rank(a) - rank(b) || a.joinedAt - b.joinedAt;
  });
  return <details className="watch-invite watch-roster" open={open} onKeyDown={event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary aria-label={`查看在线成员，${room.memberCount} 人`} aria-expanded={open}
      onClick={event => { event.preventDefault(); onOpenChange(!open); }}>
      <span className="watch-avatar-stack">
        {members.slice(0, 5).map(member => <MemberAvatar key={`${member.id}:${member.avatarUrl}`} member={member} />)}
        {members.length > 5 && <span className="watch-member-more">+{members.length - 5}</span>}
        {!members.length && <HiUserGroup aria-hidden="true" />}
      </span>
      <span className="watch-roster-count">{room.memberCount} 人在线</span>
    </summary>
    <div className="watch-invite-panel watch-roster-panel">
      <h2>在线成员 <small>{room.memberCount} 人</small></h2>
      <ul aria-label="在线成员列表">
        {members.map(member => <li key={member.id}>
          <MemberAvatar key={member.avatarUrl} member={member} />
          <strong>{member.username}</strong>
          {member.id === room.ownerId && <small className="watch-member-owner">房主</small>}
          {member.id === userId && <small>我</small>}
        </li>)}
      </ul>
      {!members.length && <p>暂无在线成员</p>}
    </div>
  </details>;
}
