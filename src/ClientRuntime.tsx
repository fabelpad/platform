'use client';
import { useEffect } from 'react';
import { registerPwa } from './pwa';
export default function ClientRuntime() { useEffect(() => registerPwa(), []); return null; }
