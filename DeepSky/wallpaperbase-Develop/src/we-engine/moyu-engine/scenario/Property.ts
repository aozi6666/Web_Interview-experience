import type { Color3 } from '../math';

/**
 * Wallpaper Engine Property System
 * 参考 linux-wallpaperengine Data/Model/Property.h, UserSetting.h, DynamicValue.cpp/h
 * 
 * 管理壁纸的用户可配置属性、动态值和条件设置。
 */

// ==================== Property Types ====================

/**
 * 属性类型枚举
 */
export enum PropertyType {
  Slider = 'slider',
  Boolean = 'boolean',
  Color = 'color',
  Combo = 'combo',
  Text = 'text',
  SceneTexture = 'scenetexture',
  File = 'file',
}

/**
 * 属性值类型
 */
export type PropertyValue = number | boolean | string | Color3;

/**
 * 壁纸属性定义
 */
export interface WallpaperProperty {
  /** 属性类型 */
  type: PropertyType;
  /** 显示名称 */
  text?: string;
  /** 当前值 */
  value: PropertyValue;
  /** 默认值 */
  defaultValue?: PropertyValue;
  /** Slider: 最小值 */
  min?: number;
  /** Slider: 最大值 */
  max?: number;
  /** Slider: 步长 */
  step?: number;
  /** Combo: 选项列表 */
  options?: Array<{ label: string; value: string }>;
  /** 条件 (根据其他属性值决定是否生效) */
  condition?: string;
}

// ==================== DynamicValue ====================

/**
 * 动态值 - 支持运行时动画的多类型值容器
 * 参考 linux-wallpaperengine DynamicValue
 */
export class DynamicValue {
  private _value: PropertyValue;
  private _animating: boolean = false;
  private _animStartValue: PropertyValue;
  private _animEndValue: PropertyValue;
  private _animDuration: number = 0;
  private _animElapsed: number = 0;

  constructor(value: PropertyValue) {
    this._value = value;
    this._animStartValue = value;
    this._animEndValue = value;
  }

  get value(): PropertyValue { return this._value; }
  set value(v: PropertyValue) {
    this._value = v;
    this._animating = false;
  }

  /** 获取数值 (如果是 number 类型) */
  getFloat(): number {
    if (typeof this._value === 'number') return this._value;
    if (typeof this._value === 'boolean') return this._value ? 1.0 : 0.0;
    return parseFloat(String(this._value)) || 0;
  }

  /** 获取布尔值 */
  getBool(): boolean {
    if (typeof this._value === 'boolean') return this._value;
    if (typeof this._value === 'number') return this._value !== 0;
    return this._value === 'true' || this._value === '1';
  }

  /** 获取颜色值 */
  getColor(): Color3 {
    if (typeof this._value === 'object' && 'r' in this._value) return this._value;
    return { r: 1, g: 1, b: 1 };
  }

  /** 开始动画过渡 */
  animateTo(endValue: PropertyValue, duration: number): void {
    this._animStartValue = this._value;
    this._animEndValue = endValue;
    this._animDuration = duration;
    this._animElapsed = 0;
    this._animating = true;
  }

  /** 更新动画 */
  update(deltaTime: number): boolean {
    if (!this._animating) return false;
    
    this._animElapsed += deltaTime;
    const t = Math.min(this._animElapsed / this._animDuration, 1);
    
    // 线性插值
    if (typeof this._animStartValue === 'number' && typeof this._animEndValue === 'number') {
      this._value = this._animStartValue + (this._animEndValue - this._animStartValue) * t;
    } else if (typeof this._animStartValue === 'object' && typeof this._animEndValue === 'object'
               && 'r' in this._animStartValue && 'r' in this._animEndValue) {
      this._value = {
        r: this._animStartValue.r + (this._animEndValue.r - this._animStartValue.r) * t,
        g: this._animStartValue.g + (this._animEndValue.g - this._animStartValue.g) * t,
        b: this._animStartValue.b + (this._animEndValue.b - this._animStartValue.b) * t,
      };
    } else {
      // 非数值类型不做动画
      this._value = t >= 1 ? this._animEndValue : this._animStartValue;
    }
    
    if (t >= 1) {
      this._animating = false;
      this._value = this._animEndValue;
    }
    
    return true; // 值发生了变化
  }
}

// ==================== UserSetting ====================

/**
 * 用户设置 - 属性连接和条件评估
 * 参考 linux-wallpaperengine UserSetting
 */
export class UserSetting {
  /** 属性名称 */
  readonly name: string;
  /** 动态值 */
  readonly dynamicValue: DynamicValue;
  /** 条件表达式 */
  private _condition: string | null;

  constructor(name: string, value: PropertyValue, condition?: string) {
    this.name = name;
    this.dynamicValue = new DynamicValue(value);
    this._condition = condition ?? null;
  }

  get value(): PropertyValue { return this.dynamicValue.value; }
  set value(v: PropertyValue) { this.dynamicValue.value = v; }

  /** 评估条件是否满足 */
  evaluateCondition(properties: Map<string, WallpaperProperty>): boolean {
    if (!this._condition) return true;
    
    // 简单条件评估: "propertyName == value" 或 "propertyName != value"
    const match = this._condition.match(/^(\w+)\s*(==|!=)\s*(.+)$/);
    if (!match) return true;
    
    const [, propName, op, expectedStr] = match;
    const prop = properties.get(propName);
    if (!prop) return true;
    
    const expected = expectedStr.trim();
    const actual = String(prop.value);
    
    if (op === '==') return actual === expected;
    if (op === '!=') return actual !== expected;
    return true;
  }
}

// ==================== PropertyManager ====================

/**
 * 属性管理器 - 管理所有壁纸属性
 */
export class PropertyManager {
  private _properties: Map<string, WallpaperProperty> = new Map();
  private _userSettings: Map<string, UserSetting> = new Map();
  private _listeners: Array<(name: string, value: PropertyValue) => void> = [];

  /**
   * 注册属性
   */
  registerProperty(name: string, prop: WallpaperProperty): void {
    this._properties.set(name, prop);
  }

  /**
   * 从 scene.json 的 general.properties 中批量注册属性
   */
  registerFromSceneProperties(properties: Record<string, unknown>): void {
    for (const [name, rawProp] of Object.entries(properties)) {
      const prop = rawProp as Record<string, unknown>;
      const type = this._parsePropertyType(String(prop.type || 'text'));
      const value = this._parsePropertyValue(prop.value, type);
      
      const wallpaperProp: WallpaperProperty = {
        type,
        text: String(prop.text || name),
        value,
        defaultValue: value,
        min: typeof prop.min === 'number' ? prop.min : undefined,
        max: typeof prop.max === 'number' ? prop.max : undefined,
        step: typeof prop.step === 'number' ? prop.step : undefined,
        condition: typeof prop.condition === 'string' ? prop.condition : undefined,
      };
      
      // Combo 选项
      if (prop.options && Array.isArray(prop.options)) {
        wallpaperProp.options = (prop.options as Array<Record<string, unknown>>).map(o => ({
          label: String(o.label || ''),
          value: String(o.value || ''),
        }));
      }
      
      this.registerProperty(name, wallpaperProp);
    }
  }

  /**
   * 获取属性值
   */
  getPropertyValue(name: string): PropertyValue | undefined {
    // 优先使用 UserSetting
    const setting = this._userSettings.get(name);
    if (setting && setting.evaluateCondition(this._properties)) {
      return setting.value;
    }
    return this._properties.get(name)?.value;
  }

  /**
   * 设置属性值
   */
  setPropertyValue(name: string, value: PropertyValue): void {
    const prop = this._properties.get(name);
    if (prop) {
      prop.value = value;
      this._notifyListeners(name, value);
    }
  }

  /**
   * 添加属性变更监听器
   */
  addListener(listener: (name: string, value: PropertyValue) => void): void {
    this._listeners.push(listener);
  }

  /**
   * 移除属性变更监听器
   */
  removeListener(listener: (name: string, value: PropertyValue) => void): void {
    const idx = this._listeners.indexOf(listener);
    if (idx >= 0) this._listeners.splice(idx, 1);
  }

  /**
   * 获取所有属性
   */
  getAllProperties(): Map<string, WallpaperProperty> {
    return new Map(this._properties);
  }

  /**
   * 更新所有动态值
   */
  update(deltaTime: number): void {
    for (const setting of this._userSettings.values()) {
      if (setting.dynamicValue.update(deltaTime)) {
        this._notifyListeners(setting.name, setting.value);
      }
    }
  }

  private _parsePropertyType(type: string): PropertyType {
    switch (type.toLowerCase()) {
      case 'slider': return PropertyType.Slider;
      case 'bool': case 'boolean': return PropertyType.Boolean;
      case 'color': return PropertyType.Color;
      case 'combo': return PropertyType.Combo;
      case 'text': case 'textinput': return PropertyType.Text;
      case 'scenetexture': return PropertyType.SceneTexture;
      case 'file': return PropertyType.File;
      default: return PropertyType.Text;
    }
  }

  private _parsePropertyValue(value: unknown, type: PropertyType): PropertyValue {
    switch (type) {
      case PropertyType.Slider:
        return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      case PropertyType.Boolean:
        return typeof value === 'boolean' ? value : value === 'true' || value === '1';
      case PropertyType.Color: {
        if (typeof value === 'string') {
          const parts = value.split(/\s+/).map(Number);
          if (parts.length >= 3) return { r: parts[0], g: parts[1], b: parts[2] };
        }
        return { r: 1, g: 1, b: 1 };
      }
      default:
        return String(value ?? '');
    }
  }

  private _notifyListeners(name: string, value: PropertyValue): void {
    for (const listener of this._listeners) {
      try { listener(name, value); } catch { /* ignore */ }
    }
  }
}
