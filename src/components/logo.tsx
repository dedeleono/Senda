'use client';

import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import logo from '@/public/1.svg';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function ThemeAwareLogo({ width = 100, height = 100, className }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <Image src={logo} alt="logo" width={width} height={height} className={`${className} `} />
}