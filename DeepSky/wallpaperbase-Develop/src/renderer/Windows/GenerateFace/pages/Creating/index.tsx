import right from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose2__size_32.png';
import { useEffect, useRef, useState } from 'react';
import { BackendButton } from '../UploadPhoto/components';
import { GenerateStep } from '../UploadPhoto/types';
import { useStyles } from './styles';

interface CreatingProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onRetry: () => void;
  onConfirm: () => void;
  onDressUp: () => void;
  onPreviewStatic: () => void;
  progress: number;
  generateStep: GenerateStep;
  waitCount : number;
}

// 进度加载组件
function ProgressLoading({
  progress,
  loadingText,
  styles,
  waitText,
  waitCount,
}: {
  progress: number;
  loadingText: string;
  styles: any;
  waitText: string;
  waitCount: number;
}) {
  return (
    <div style={{height:`186px`}}>
      <div className={styles.staicText1}>{loadingText}</div>
      <div className={styles.loadingBg}>
        <div
          className={styles.loadingInner}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className={styles.loadingText}>{progress}%</div>
      <div className={styles.loadingTip}>
      {waitText}预计还需等待{Math.round(waitCount + (170 - progress) / 100)}分钟
      </div>
    </div>
  );
}

// 完成状态组件
function CompletedStatus({
  completedText,
  button1Text,
  button1Click,
  button2Text,
  button2Click,
  styles,
}: {
  completedText: string;
  button1Text: string;
  button1Click: () => void;
  button2Text: string;
  button2Click: () => void;
  styles: any;
}) {
  return (
    <>
      <div style={{height:`326px`}}>
        <img className={styles.staticDone} src={right} />
        <div className={styles.staticDoneText}>{completedText}</div>
      </div>
      <div className={styles.geButtonContent}>
        <button className={styles.geButton1} onClick={button1Click}>
          {button1Text}
        </button>
        <button className={styles.geButton2} onClick={button2Click}>
          {button2Text}
        </button>
      </div>
    </>
  );
}

// 步骤指示器组件
function StepIndicator({
  isStaticPhase,
  styles,
}: {
  isStaticPhase: boolean;
  styles: any;
}) {
  return (
    <div className={styles.stepBg}>
      <div
        className={styles.step1}
        style={
          isStaticPhase
            ? {}
            : {
                background: `rgba(115, 115, 115, 1)`,
                color: 'rgba(204, 204, 204, 1)',
              }
        }
      >
        1
      </div>
      <div
        className={styles.step1Text}
        style={isStaticPhase ? {} : { color: 'rgba(115, 115, 115, 1)' }}
      >
        静态预览{' '}
      </div>
      <div
        className={styles.stepLine}
        style={
          isStaticPhase
            ? {}
            : {
                background: `linear-gradient(90deg, rgba(115, 115, 115, 1) 25%, rgba(29, 223, 223, 1) 100%)`,
              }
        }
      ></div>
      <div
        className={styles.step2}
        style={
          isStaticPhase
            ? {}
            : {
                background: `rgba(29, 223, 223, 1)`,
                color: 'rgba(51, 51, 51, 1)',
              }
        }
      >
        2
      </div>
      <div
        className={styles.step2Text}
        style={isStaticPhase ? {} : { color: 'rgba(29, 223, 223, 1)' }}
      >
        可驱动角色{' '}
      </div>
    </div>
  );
}

function Creating({
  isOpen,
  onClose,
  onNext,
  onRetry,
  onConfirm,
  onDressUp,
  onPreviewStatic,
  progress,
  generateStep,
  waitCount,
}: CreatingProps) {
  const { styles } = useStyles();
  const [displayProgress, setDisplayProgress] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const countRef = useRef(0);
  const delayCloseRef = useRef(false);
  const animatetexts = ['','.','..','...']
  const updateRef = useRef<number>(0);
  const [animateText, setAnimateText] = useState<string>('.');
  const delay = 3
  const autoDelay = useRef<number>(0);
  useEffect(() => {
    if (!isOpen || waitCount > 0) {
    //   if (rafRef.current) {
    //     cancelAnimationFrame(rafRef.current);
    //     rafRef.current = null;
    //   }
    //   setTimeout(() => {
    //     delayCloseRef.current = false;
    //     setDisplayProgress(0);
    //     // console.log('delayclosee---')
    //   }, 600);
      return;
    }
    if (progress === 0){
      // console.log('-----------------')
      updateRef.current = 0;
      setDisplayProgress(0);
    }
    const exponentialProgress = (t:number, k = 0.01/delay) => {
      const progress = 100 * (1 - Math.exp(-k * t));
      return Math.round(progress);
    };
    const animate = () => {
      delayCloseRef.current = true;
      countRef.current += 1;
      updateRef.current += 1;
      setAnimateText(animatetexts[Math.floor(updateRef.current/50)%4]);
      // if (updateRef.current >= 1000) {
      //   updateRef.current = 0;
      // }
      // if (countRef.current < delay) {
      //   rafRef.current = requestAnimationFrame(animate);
      //   return;
      // }else{
      //   countRef.current = 0;
      // }
      
      if (progress === 100 ) {
        // console.log('冲刺到 100')
        setDisplayProgress(100);
        return;
      }
      // else 
      if (displayProgress < progress) {
        setDisplayProgress((prev) => prev+1);
        if (displayProgress === 100){
          setDisplayProgress(0);
        }
      }
      // console.log('generateStep',generateStep,progress,displayProgress)
      if (generateStep === GenerateStep.STATIC_GENERATING){
        // autoDelay.current += 1;
        // // console.log('autoDelay.current',autoDelay.current)
        // if (autoDelay.current >= 12){
        //   autoDelay.current = 0;
        //   if (displayProgress < 99){
        //     setDisplayProgress((prev) => prev+1);
        //   }
        // }
        const p = Math.min(99,exponentialProgress(updateRef.current,0.0008));
        setDisplayProgress(p);
      }
      if(generateStep === GenerateStep.DYNAMIC_GENERATING){
        // autoDelay.current += 1;
        // // console.log('autoDelay.current',autoDelay.current)
        // if (autoDelay.current >= 50){
        //   autoDelay.current = 0;
        //   if (displayProgress < 99){
        //     setDisplayProgress((prev) => prev+1);
        //   }
        // }
        const p = Math.min(99,exponentialProgress(updateRef.current,0.0006));
        setDisplayProgress(p);
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
  }, [isOpen, displayProgress, onClose,progress,waitCount]);


  if (!isOpen) return null;

  // 判断当前阶段
  const isStaticPhase =
    generateStep === GenerateStep.STATIC_GENERATING ||
    generateStep === GenerateStep.STATIC_COMPLETED;
  const isDynamicPhase =
    generateStep === GenerateStep.DYNAMIC_GENERATING ||
    generateStep === GenerateStep.DYNAMIC_COMPLETED;
  
  return (
    <div className={styles.preOverlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.preContent}>
        <div className={styles.backContainer}>
          <div className={styles.right}>
            <BackendButton onBack={onClose} />
          </div>
          
        </div>
        <div className={styles.preTitle}>生成进度</div>
        <div className={styles.preImgBg}>
          {(isStaticPhase || isDynamicPhase) && (
            <div className={styles.contentWrapper}>
              {/* 步骤指示器 */}
              <StepIndicator isStaticPhase={isStaticPhase} styles={styles} />

              {/* 加载中状态 */}
              {displayProgress < 100 && (
                <ProgressLoading
                  progress={displayProgress}
                  loadingText={
                    isStaticPhase ? `静态预览加载中${animateText}` : `可驱动角色加载中${animateText}`
                  }
                  waitText = {(typeof waitCount === 'number' && waitCount > 0) ? `前面有${waitCount}人正在创建角色，` : ''}
                  styles={styles}
                  waitCount={waitCount}
                />
              )}

              {/* 完成状态 */}
              {displayProgress === 100 && (
                <CompletedStatus
                  completedText={
                    isStaticPhase ? '静态预览完成' : '可驱动角色完成'
                  }
                  button1Text={isStaticPhase ? '重新生成' : '确认'}
                  button1Click={isStaticPhase ? onRetry : onConfirm}
                  button2Text={isStaticPhase ? '下一步' : '装扮'}
                  button2Click={isStaticPhase ? onNext : onDressUp}
                  styles={styles}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Creating;
