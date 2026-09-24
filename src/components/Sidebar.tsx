import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
  HiHome, 
  HiFilm, 
  HiDesktopComputer, 
  HiSparkles, 
  HiStar,
  HiVideoCamera
} from 'react-icons/hi';
import { HiCog6Tooth } from 'react-icons/hi2';
import Logo from './Logo';

const Sidebar = () => {
  const location = useLocation();
  
  // Menu items based on the website
  const menuItems = [
    { id: 1, name: '首页', icon: HiHome, link: '/' },
    { id: 2, name: '电影', icon: HiFilm, link: '/movies' },
    { id: 5, name: '综艺', icon: HiStar, link: '/variety' },
    { id: 3, name: '电视剧', icon: HiDesktopComputer, link: '/tv' },
    { id: 4, name: '动漫', icon: HiSparkles, link: '/anime' },
    { id: 6, name: '短剧', icon: HiVideoCamera, link: '/short' },
    { id: 7, name: '后台', icon: HiCog6Tooth, link: '/admin' },
  ];

  return (
    <div className="sidebar-nav h-screen w-[220px] fixed left-0 top-0 p-6 flex flex-col bg-white border-r border-gray-100">
      <div className="mb-10">
        <Logo />
      </div>

      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.link;
            return (
              <li key={item.id}>
                <a
                  href={item.link}
                  className={`flex items-center gap-3 px-4 py-2.5 text-gray-600 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-red-50 to-pink-50 text-red-600 shadow-sm' 
                      : 'hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className="font-medium">{item.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*<div className="mt-auto pt-4 border-t border-gray-100">*/}
      {/*  <a*/}
      {/*    href="/settings"*/}
      {/*    className={`flex items-center gap-3 px-4 py-2.5 text-gray-600 rounded-lg transition-all duration-200 ${*/}
      {/*      location.pathname === '/settings' */}
      {/*        ? 'bg-gradient-to-r from-red-50 to-pink-50 text-red-600 shadow-sm' */}
      {/*        : 'hover:bg-gray-50 hover:text-gray-900'*/}
      {/*    }`}*/}
      {/*  >*/}
      {/*    <HiCog6Tooth className={`w-5 h-5 ${location.pathname === '/settings' ? 'text-red-500' : 'text-gray-400'}`} />*/}
      {/*    <span className="font-medium">设置</span>*/}
      {/*  </a>*/}
      {/*</div>*/}
    </div>
  );
};

export default Sidebar;
