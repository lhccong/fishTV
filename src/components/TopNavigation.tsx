import { Link, useLocation } from 'react-router-dom';
import { HiHome, HiFilm, HiDesktopComputer, HiSparkles, HiStar, HiVideoCamera } from 'react-icons/hi';
import Logo from './Logo';

const items = [
  { name: '首页', path: '/', icon: HiHome },
  { name: '电影', path: '/movies', icon: HiFilm },
  { name: '电视剧', path: '/tv', icon: HiDesktopComputer },
  { name: '综艺', path: '/variety', icon: HiStar },
  { name: '动漫', path: '/anime', icon: HiSparkles },
  { name: '短剧', path: '/short', icon: HiVideoCamera },
];

export default function TopNavigation() {
  const { pathname } = useLocation();
  return <div className="top-navigation">
    <Link to="/" className="top-brand" aria-label="摸鱼 TV 首页"><Logo /></Link>
    <nav aria-label="主导航">
      {items.map(({ name, path, icon: Icon }) => {
        const active = pathname === path || (path === '/' && pathname === '/rooms');
        return <Link key={path} to={path} aria-current={active ? 'page' : undefined}>
          <Icon aria-hidden="true" /><span>{name}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
