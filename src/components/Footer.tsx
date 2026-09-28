import React from 'react';
import Logo from './Logo';

const Footer = () => {
  return (
    <footer className="mt-14 border-t border-white/5 bg-black/10 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Logo />
          </div>

          <div className="flex space-x-4">
            <a href="/rss" className="text-gray-600 text-sm hover:text-primary">RSS</a>
            <a href="/baidu" className="text-gray-600 text-sm hover:text-primary">Baidu</a>
            <a href="/google" className="text-gray-600 text-sm hover:text-primary">Google</a>
            <a href="/sogou" className="text-gray-600 text-sm hover:text-primary">Sogou</a>
          </div>
        </div>

        <div className="text-center mt-6 text-gray-500 text-xs">
          <p>本站所有资源均来源于网络，仅供学习交流。如有侵权，请联系我们删除。</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
