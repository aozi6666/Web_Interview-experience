import {
  ColorPicker,
  Input,
  InputNumber,
  Slider,
  Space,
  Typography,
} from 'antd';
import { useCallback, useEffect } from 'react';
import '../../index.css';
import { useStyles } from './styles';

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
interface LightProps {
  lightDatas : LightData[];
  onSetLight?: (data:LightData[]) => void;
}
const Light:React.FC<LightProps> = ({lightDatas,onSetLight})=> {
  const { styles } = useStyles();
  // const filteredTemplates = CREATION_TEMPLATES.filter(
  //   (template) => template.type === 'light',
  // );
  // useEffect(() => {
  //   if (onSelectLight) {
  //     onSelectLight(filteredTemplates);
  //   }
  // }, [onSelectLight, filteredTemplates]);
  // 初始化灯光数据状态
  // const [lights, setLights] = useState<LightData[]>(
  //   filteredTemplates.map((template) => ({
  //     id: template.id,
  //     color: 'D9D9D9',
  //     intensity: 30,
  //   })),
  // );
  const generateRandomId = (): string => {
    return Math.random().toString(36).slice(2, 10);
  };

  // 生成 LightData 初始值对象的函数
  const createDefaultLightData = (): LightData => {
    return {
      id: generateRandomId(),
      color: 'D9D9D9',
      intensity: 30,
    };
  };

  // 校验单个对象是否符合 LightData 接口规范
  const isValidLightData = (obj: any): obj is LightData => {
    // 必须是对象、非 null，且包含所有必填字段，字段类型匹配
    return (
      typeof obj === 'object' &&
      obj !== null &&
      typeof obj.id === 'string' &&
      typeof obj.color === 'string' &&
      typeof obj.intensity === 'number'
    );
  };

  useEffect(() => {
    const initialize = async () => {
      const validLightDatas = lightDatas.filter(isValidLightData);
      const needAddCount = 2 - validLightDatas.length;
      for (let i = 0; i < needAddCount; i++) {
        validLightDatas.push(createDefaultLightData());
      }
      if (onSetLight){
        onSetLight(validLightDatas);
      }
    };
    initialize();
  }, []);

  // 处理滑块变化
  const handleSliderChange = useCallback((id: string, newValue: number) => {
    // setLights((prevLights) =>
    //   prevLights.map((light) =>
    //     light.id === id ? { ...light, intensity: newValue } : light,
    //   ),
    // );
    const updatedDatas = lightDatas.map((light) => {
      if (light.id === id) {
        return {
          ...light,
          intensity: newValue,
        };
      }
      return light;
    });
    // console.log(updatedDatas)
    if (onSetLight){
      onSetLight(updatedDatas);
    }
    
  }, [lightDatas]);

  // 处理颜色变化
  const handleColorChange = useCallback((id: string, newColor: string) => {
    // setLights((prevLights) =>
    //   prevLights.map((light) =>
    //     light.id === id
    //       ? { ...light, color: newColor.replace('#', '').toUpperCase() }
    //       : light,
    //   ),
    // );
    const updatedDatas = lightDatas.map((light) => {
      if (light.id === id) {
        return {
          ...light,
          color: newColor.replace('#', '').toUpperCase(),
        };
      }
      return light;
    });

    if (onSetLight){
      onSetLight(updatedDatas);
    }
  }, [lightDatas]);

  // 处理颜色输入框变化
  const handleColorInputChange = useCallback(
    (id: string, value: string) => {
      // 只允许输入十六进制字符
      const hexValue = value
        .replace(/[^0-9A-Fa-f]/g, '')
        .toUpperCase()
        .slice(0, 6);
      if (hexValue.length === 6) {
        handleColorChange(id, hexValue);
      } else {
        // setLights((prevLights) =>
        //   prevLights.map((light) =>
        //     light.id === id ? { ...light, color: hexValue } : light,
        //   ),
        // );
        const updatedDatas = lightDatas.map((light) => {
          if (light.id === id) {
            return {
              ...light,
              color: hexValue,
            };
          }
          return light;
        });
        if (onSetLight){
          onSetLight(updatedDatas);
        }
      }
    },[lightDatas,handleColorChange],
  );

  return (
    <div className={styles.container}>
      <div className={styles.content1}>
        {lightDatas.map((lightData,index) => {
          // const lightData = lights.find((light) => light.id === template.id);
          if (!lightData) return null;

          return (
            <div key={lightData.id} className={styles.content2}>
              <div className={styles.title}>{index+1}号灯光</div>

              {/* 颜色控制行 */}
              <div className={styles.controlRow}>
                <Text className={styles.label}>颜色</Text>
                <ColorPicker
                  value={`#${lightData.color}`}
                  onChange={(color) =>
                    handleColorChange(lightData.id, color.toHexString())
                  }
                  showText={false}
                  size="small"
                  format="hex"
                >
                  <div
                    className={styles.colorSwatch}
                    style={{ backgroundColor: `#${lightData.color}` }}
                  />
                </ColorPicker>
                <div className={styles.colorControl}>
                  <Space.Compact className={styles.colorInputWrapper}>
                    <Input
                      prefix="#"
                      value={lightData.color}
                      onChange={(e) =>
                        handleColorInputChange(lightData.id, e.target.value)
                      }
                      className={styles.colorInput}
                      maxLength={6}
                    />
                  </Space.Compact>
                </div>
              </div>

              {/* 强度控制行 */}
              <div className={styles.controlRow}>
                <Text className={styles.label}>强度</Text>
                <div className={styles.intensityControl}>
                  <Slider
                    className={styles.slider}
                    value={lightData.intensity}
                    onChange={(val) => handleSliderChange(lightData.id, val)}
                    min={0}
                    max={100}
                    tooltip={{ open: false }}
                  />
                  <InputNumber
                    value={lightData.intensity}
                    onChange={(val) =>
                      handleSliderChange(lightData.id, val || 0)
                    }
                    min={0}
                    max={100}
                    className={styles.intensityValue}
                    controls={false}
                  />
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
