import React, { useEffect, useRef, useState } from 'react';

// 处理文本中的括号，应用不同样式
function renderTextWithParenthesesStyles(text: string) {
  if (!text) return text;

  // 使用正则表达式匹配括号内容
  const parts = text.split(/(\([^)]*\)|（[^）]*）)/g);

  return parts.map((part, index) => {
    // 检查是否是括号内容
    if (part.match(/^\([^)]*\)$|^\（[^）]*\）$/)) {
      return (
        <span key={index} style={{ fontSize: '12px', color: '#888', opacity: 0.7 }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// 逐字显示文字组件
interface TypingTextProps {
  text: string;
  speed?: number;
}

const TypingText: React.FC<TypingTextProps> = ({ text, speed = 100 }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTextRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef<boolean>(false);

  // 当文本改变时智能处理状态
  // useEffect(() => {
  //   const prevText = prevTextRef.current;

  //   console.log('TypingText: 旧文本:', prevText);
  //   console.log('TypingText: 新文本:', text);

  //   // 如果新文本与之前完全相同，跳过处理
  //   // if (text === prevText) {
  //   //   console.log('TypingText: 文本相同，跳过处理');
  //   //   return;
  //   // }

  //   // // 如果新文本是之前文本的超集（累积），继续累积显示
  //   // if (prevText && text.startsWith(prevText) && text.length > prevText.length) {
  //   //   // 累积模式：文本是连续的，不需要重置状态
  //   //   // currentIndex会继续从当前位置递增显示新增的字符
  //   //   console.log('TypingText: 累积模式，继续显示');
  //   // } else {
  //   //   // 完全不同的文本，重置状态
  //   //   console.log('TypingText: 完全不同的文本，重置状态');
  //   //   setDisplayText('');
  //   //   setCurrentIndex(0);
  //   //   if (timeoutRef.current) {
  //   //     clearTimeout(timeoutRef.current);
  //   //     timeoutRef.current = null;
  //   //   }
  //   //   isTypingRef.current = false;
  //   // }

  //   prevTextRef.current = text;
  // }, [text]);

  // 处理打字动画 - 确保逐字显示
  useEffect(() => {
    const typeNextChar = () => {
      if (currentIndex < text.length && !isTypingRef.current) {
        isTypingRef.current = true;
        timeoutRef.current = setTimeout(() => {
          setDisplayText((prev) => prev + text[currentIndex]);
          setCurrentIndex((prev) => prev + 1);
          isTypingRef.current = false;
        }, speed);
      }
    };

    typeNextChar();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isTypingRef.current = false;
    };
  }, [currentIndex, text, speed]);

  // 当显示文本更新时，自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current.parentElement;
      if (container) {
        // 滚动到容器底部
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [displayText]);

  return <div ref={containerRef}>{renderTextWithParenthesesStyles(displayText)}</div>;
};

TypingText.defaultProps = {
  speed: 50,
};

export default TypingText;
