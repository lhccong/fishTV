import React, { type ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-shell flex min-h-screen">
      <div className="min-w-0 flex-1">
        <Header />
        
        <main className="w-full max-w-[1500px] mx-auto px-3 sm:px-6 md:px-8 py-5 sm:py-7 md:py-9">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Layout;
