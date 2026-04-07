interface FollowProps {
  isHovered: boolean;
}

function Follow({ isHovered }: FollowProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(10px)',
        borderRadius: '50px',
        padding: '8px 16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.3s ease',
        opacity: isHovered ? 1 : 0.8,
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}
    >
      {/* 头像 */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff6b6b, #ffa500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'white',
        }}
      >
        🌸
      </div>
      {/* 用户信息 */}
      <div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'white',
            marginBottom: '2px',
          }}
        >
          漂亮大美女精灵
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>5.1万本场点赞</span>
          <button
            type="button"
            style={{
              background: '#ff4757',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '10px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            关注
          </button>
        </div>
      </div>
    </div>
  );
}

export default Follow;
