'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

import '@solana/wallet-adapter-react-ui/styles.css';

// Define the type for walletAddress explicitly if not provided by the hook
interface PhantomWalletData {
  walletAddress: string | null | undefined;
  balance: number | null;
  participants: string[];
  fetchLotteryData: () => void;
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { walletAddress, balance, participants, fetchLotteryData } = usePhantomWallet() as PhantomWalletData;
  const { } = useWallet();

  useEffect(() => {
    setIsMounted(true);
    const stars = () => {
      const count = 100;
      const background = document.querySelector(`.${styles.spaceBackground}`);
      if (background) {
        for (let i = 0; i < count; i++) {
          const star = document.createElement('div');
          star.className = styles.star;
          star.style.left = `${Math.random() * 100}%`;
          star.style.top = `${Math.random() * 100}%`;
          star.style.animationDelay = `${Math.random() * 5}s`;
          background.appendChild(star);
        }
      }
    };
    stars();

    fetchLotteryData();
    fetchChatMessages();
    const intervalId = setInterval(fetchLotteryData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchLotteryData]);

  const fetchChatMessages = async () => {
    try {
      const response = await fetch('/api/chat');
      if (!response.ok) throw new Error(`Failed to fetch chat messages: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages(data.map((msg) => `${msg.username}: ${msg.message}`));
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (walletAddress && newMessage.trim()) {
      const username = walletAddress.slice(0, 4); // Now TypeScript knows walletAddress is a string when present
      const messageData = { username, message: newMessage, walletAddress };
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData),
        });
        if (!response.ok) throw new Error(`Failed to send message: ${response.status}`);
        setMessages((prev) => [...prev, `${username}: ${newMessage}`]);
        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message');
      }
    } else if (!walletAddress) {
      alert('Please connect your wallet to send messages.');
    }
  };

  const toggleChat = () => {
    if (isChatOpen) {
      setIsChatVisible(false);
      setTimeout(() => setIsChatOpen(false), 800);
    } else {
      setIsChatOpen(true);
      setIsChatVisible(true);
    }
  };

  const onlineWallets = participants.includes(walletAddress as string)
    ? participants.length
    : (walletAddress ? 1 : 0) + participants.length;

  return (
    <div className={`${styles.container} h-screen overflow-hidden`}>
      <div className={`${styles.spaceBackground} relative h-full w-full`}>
        <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent py-1 px-4 flex justify-end items-center h-10 space-x-2">
          <button className={styles.navButton}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button className={styles.navButton} onClick={toggleChat}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
          {isMounted && (
            <WalletModalProvider>
              <WalletMultiButton className={styles.walletButton} />
              {walletAddress && (
                <div className="text-white text-sm flex items-center">
                  {typeof balance === 'number' ? `${balance.toFixed(4)} SOL` : 'Loading...'}
                </div>
              )}
            </WalletModalProvider>
          )}
          <button className={styles.navButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {isMenuOpen && (
            <div className={styles.mobileMenu}>
              <Link href="/" className={`${styles.menuLink} text-lg md:text-xl`} onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
              <Link href="/solana-draw" className={`${styles.menuLink} text-lg md:text-xl`} onClick={() => setIsMenuOpen(false)}>
                Solana Draw
              </Link>
            </div>
          )}
        </nav>

        {isChatOpen && (
          <div
            className={`fixed top-0 left-0 h-full w-1/6 p-4 overflow-y-auto z-40 border-r border-white/10 bg-gray-900/25 ${
              isChatVisible ? styles.chatSlideIn : styles.chatSlideOut
            }`}
          >
            <h3 className={styles.chatTitle}>Chat</h3>
            <div className={styles.chatMessages}>
              {messages.map((msg, index) => (
                <div key={index} className={styles.messageBox}>
                  <p className={styles.messageText}>{msg}</p>
                </div>
              ))}
            </div>
            <div className={styles.chatInputContainer}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className={styles.chatInput}
                placeholder="Type a message..."
              />
              <button onClick={handleSendMessage} className={styles.sendButton}>
                Send
              </button>
            </div>
          </div>
        )}

        <div
          className={`${styles.content} flex flex-col items-center justify-center h-[calc(100%-2.5rem)] w-full pt-10 ${
            isChatOpen ? 'ml-[16.67%] w-[83.33%]' : ''
          }`}
        >
          <div className="mb-2">
            <Image
              src="/logo.png"
              alt="Solana Lottery Logo"
              width={650}
              height={450}
              className={`${styles.logoBounce} object-contain w-auto h-auto`}
              priority
            />
          </div>
          <h1 className="text-center text-7xl font-extrabold text-white mb-4 mt-2">
            <span className="text-white transition-colors glow">Solana Gateway</span>
          </h1>
          <p className={styles.subtitle}>It’s good to see you here..</p>
        </div>

        <div className="fixed bottom-4 right-4 z-50 flex items-center bg-gray-800/80 text-white rounded-full px-3 py-1 shadow-lg">
          <span
            className={`w-3 h-3 rounded-full mr-2 ${
              onlineWallets > 0 ? 'bg-green-500' : 'bg-red-500'
            }`}
          ></span>
          <span className="text-sm">
            {onlineWallets > 0 ? `${onlineWallets} ONLINE` : '0 ONLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}