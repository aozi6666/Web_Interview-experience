// LoadingModal.tsx（单文件组件，无第三方依赖）
import React from 'react';
import {useRef,useCallback,useState,useEffect} from 'react';
import { useStyles } from './styles';
import sample_1 from '$assets/images/uploadPhoto/sample_1.png';
// 组件属性接口
interface LoadingModalProps {
  visible: boolean;
  progress?: number;
  message: string;
  closable?: boolean;
  onClose?: () => void;
  delay?: number;
}

const LoadingModal: React.FC<LoadingModalProps> = ({
  visible,
  progress = 0,
  message,
  closable = false,
  onClose,
  delay = 3,
}) => {
  const { styles } = useStyles();
  const [currentProgress, setCurrentProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const [delayClose,setDelayClose] = useState(false);
  const animatetexts = ['','.','..','...']
  const updateRef = useRef<number>(0);
  const [animateText, setAnimateText] = useState<string>('.');
  useEffect(() => {
    if (!visible) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // console.log('delayclose---1')
      setTimeout(() => {
        // delayCloseRef.current = false;
        setDelayClose(false);
        setCurrentProgress(0);
        // console.log('delayclosee---')
      }, 600);
      return;
    }
    const animate = () => {
      // delayCloseRef.current = true;
      setDelayClose(true);
      countRef.current += 1;
      updateRef.current += 1;
      setAnimateText(animatetexts[Math.floor(updateRef.current/50)%4]);
      if (updateRef.current >= 1000) {
        updateRef.current = 0;
      }
      if (countRef.current < delay) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }else{
        countRef.current = 0;
      }
      
      if (progress === 100 ) {
        // console.log('冲刺到 100')
        setCurrentProgress(100);
        return;
      }
      else if (currentProgress < 99) {
        setCurrentProgress((prev) => prev+1);
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [visible, currentProgress, onClose,progress]);

  // if (!visible) return null;
  const circleRadius = 44;
  const circumference = 2 * Math.PI * circleRadius;
  
  const handleOverlayClick = () => {
    if (closable && onClose && currentProgress == 100) {
      onClose();
    }
  };
  // console.log('-----------显示loading,visible------delayCloseRef-----',visible,delayClose)
  if (!visible && !delayClose ) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.mask} onClick={handleOverlayClick} />
      
      <div className={styles.content}>
        <div className={styles.progress}>{currentProgress}%</div>
        <svg width="114" height="114" style={{ transform: 'rotate(-90deg)',transformOrigin: '50% 50%'  }}>
          <circle cx="57" cy="57" r="44" fill="none" stroke="rgba(51, 51, 51, 1)" strokeWidth="12" />
          <defs>
                <linearGradient id="dynamicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(25, 200, 200, 1)" stopOpacity="1" />
                    <stop offset="15%" stopColor="#8CE4E4" stopOpacity="1" />
                    <stop offset="30%" stopColor="rgba(25, 200, 200, 1)" stopOpacity="1" />
                    <animateTransform
                        attributeName="gradientTransform"
                        type="rotate"
                        from="0 0.5 0.5"
                        to="360 0.5 0.5"
                        dur="3s"
                        repeatCount="indefinite"
                        additive="sum"
                    />
                </linearGradient>
            </defs>
          <circle //className={styles.cssColorGradient}
            // cx="57" cy="57" r="44" fill="none" stroke="rgba(25, 200, 200, 1) "
            cx="57" cy="57" r="44" fill="none" stroke="url(#dynamicGradient)"
            strokeWidth="12" strokeLinecap="round"
            style={{ 
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset: `${circumference - (currentProgress / 100) * circumference}`,
              transition: 'stroke-dashoffset 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'stroke-dashoffset'
            }}
          />
          
        </svg>
        
        <p className={styles.message} >{message}{animateText}</p>
      </div>
    </div>
  );
};

export default LoadingModal;