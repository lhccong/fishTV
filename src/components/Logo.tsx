import React from 'react';

const Logo = () => {
  return (
    <div className="flex items-center">
      <img
        src="https://oss.cqbo.com/moyu/moyu.png"
        alt="摸鱼 TV"
        className="w-8 h-8 mr-2"
      />
      <span className="text-xl font-bold freeok-logo">摸鱼 TV</span>
    </div>
  );
};

export default Logo;
