import '../../../../index.css';
import { useCallback, useState } from 'react';
import { Space, Slider, InputNumber, Typography, ColorPicker } from 'antd';
import { useStyles } from '../../../../pages/Light/styles';

const { Text } = Typography;

interface CreationTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: string;
  type: 'wallpaper' | 'character' | 'scene' | 'light' | 'music';
}

interface LightData {
  id: string;
  color: string;
  intensity: number;
}

const CREATION_TEMPLATES: CreationTemplate[] = [
  {
    id: '3',
    name: '1',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'light',
  },
  {
    id: '9',
    name: '2',
    description: '个性化角色创建模板',
    author: '官方',
    thumbnail: '',
    type: 'light',
  },
];

function Light() {
  const { styles } = useStyles();
  const filteredTemplates = CREATION_TEMPLATES.filter(
    (template) => template.type === 'light',
  );

  // 初始化灯光数据状态
  const [lights, setLights] = useState<LightData[]>(
    filteredTemplates.map((template) => ({
      id: template.id,
      color: 'D9D9D9',
      intensity: 30,
    })),
  );

  // 处理滑块变化
  const handleSliderChange = useCallback((id: string, newValue: number) => {
    setLights((prevLights) =>
      prevLights.map((light) =>
        light.id === id ? { ...light, intensity: newValue } : light,
      ),
    );
  }, []);

  // 处理颜色变化
  const handleColorChange = useCallback((id: string, newColor: string) => {
    setLights((prevLights) =>
      prevLights.map((light) =>
        light.id === id
          ? { ...light, color: newColor.replace('#', '').toUpperCase() }
          : light,
      ),
    );
  }, []);
  return (
    <div className="light-container">
      <div className="templatesGrid.light">
        {filteredTemplates.map((template) => {
          const lightData = lights.find((light) => light.id === template.id);
          if (!lightData) return null;

          return (
            <div key={template.id} className="light">
              <p>{template.name}号灯光</p>
              <div className="light-content">
                <div className="light-content-item">
                  {/* 颜色控制行 */}
                  <div className={styles.line1}>
                    <Space
                      size="middle"
                      align="center"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        className={styles.text1}
                        style={{ lineHeight: '32px' }}
                      >
                        颜色
                      </Text>
                      {/* <div
                        className={styles.colorRect}
                        style={{ backgroundColor: `#${lightData.color}` }}
                      />
                      <Space.Compact>
                        <Input
                          prefix="#"
                          value={lightData.color}
                          onChange={(e) =>
                            handleColorChange(template.id, e.target.value)
                          }
                          className={styles.colorInput}
                          maxLength={6}
                          style={{
                            backgroundColor: 'rgba(55, 59, 57, 1)',
                            border: 'none',
                            color: 'white',
                          }}
                        />
                      </Space.Compact> */}
                      <ColorPicker
                        value={`#${lightData.color}`}
                        onChange={(color) =>
                          handleColorChange(template.id, color.toHexString())
                        }
                        showText
                        size="large"
                        format="hex"
                        style={{ position: 'relative', right: -200 }}
                      />
                    </Space>
                  </div>
                  <div className={styles.line2}>
                    <Space
                      size="middle"
                      align="center"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        className={styles.text1}
                        style={{ lineHeight: '32px' }}
                      >
                        强度
                      </Text>
                      <div
                        className={styles.intensity}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 8px',
                          height: '32px',
                        }}
                      >
                        <Slider
                          className={styles.slider1}
                          value={lightData.intensity}
                          onChange={(val) =>
                            handleSliderChange(template.id, val)
                          }
                          min={0}
                          max={100}
                          tooltip={{ open: false }}
                          style={{
                            flex: 1,
                            margin: 0,
                            position: 'relative',
                            left: 0,
                            width: 'auto',
                          }}
                        />
                        <InputNumber
                          value={lightData.intensity}
                          onChange={(val) =>
                            handleSliderChange(template.id, val || 0)
                          }
                          min={0}
                          max={100}
                          className={styles.text3}
                          controls={false}
                          style={{
                            width: 50,
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'rgba(236, 238, 237, 1)',
                            marginLeft: 8,
                            position: 'relative',
                            left: 0,
                          }}
                        />
                      </div>
                    </Space>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Light;
