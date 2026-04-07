import refreshIcon from '$assets/images/uploadPhoto/refresh-ccw-01.png';
import React, { useEffect, useRef, useState } from 'react';
import { useStyles } from './styles';

type StructuredTextValue = Record<string, string>;

interface TextEditPanelProps {
  title: string;
  initialText: string | StructuredTextValue;
  defaultText?: string | StructuredTextValue;
  onTextChange: (value: string | StructuredTextValue) => void;
  extraActions?: React.ReactNode;
  fieldTitles?: Record<string, string>;
}

const DEFAULT_MAX_PREVIEW_LINES = 10;
const STRUCTURED_MAX_PREVIEW_LINES = 2;

const isStructuredValue = (
  value: string | StructuredTextValue | undefined,
): value is StructuredTextValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function TextEditPanel({
  title,
  initialText,
  defaultText = '',
  onTextChange,
  extraActions,
  fieldTitles,
}: TextEditPanelProps) {
  const { styles } = useStyles();
  const [isEditing, setIsEditing] = useState(false);
  const [contentText, setContentText] = useState(
    typeof initialText === 'string' ? initialText : '',
  );
  const [beforeEditText, setBeforeEditText] = useState(
    typeof initialText === 'string' ? initialText : '',
  );
  const [structuredText, setStructuredText] = useState<StructuredTextValue>(
    isStructuredValue(initialText) ? { ...initialText } : {},
  );
  const [beforeEditStructuredText, setBeforeEditStructuredText] =
    useState<StructuredTextValue>(
      isStructuredValue(initialText) ? { ...initialText } : {},
    );
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const isStructuredMode = isStructuredValue(initialText);

  useEffect(() => {
    if (isStructuredValue(initialText)) {
      const nextText = { ...initialText };
      setStructuredText(nextText);
      setBeforeEditStructuredText(nextText);
      setEditingFieldKey(null);
      return;
    }
    const nextText = initialText || '';
    setContentText(nextText);
    setBeforeEditText(nextText);
  }, [initialText]);

  const handleEdit = () => {
    autoHeight();
    setIsEditing(true);
  };

  const handleCancel = () => {
    setContentText(beforeEditText);
    setIsEditing(false);
  };

  const handleSave = () => {
    setBeforeEditText(contentText);
    setIsEditing(false);
    onTextChange(contentText);
  };

  const handleReset = () => {
    const nextText = defaultText || '';
    if (typeof nextText === 'string') {
      setContentText(nextText);
      setBeforeEditText(nextText);
    }
    setIsEditing(false);
    onTextChange(nextText);
  };

  const handleStructuredEdit = (fieldKey: string) => {
    setEditingFieldKey(fieldKey);
    autoHeight(fieldKey);
  };

  const handleStructuredCancel = () => {
    if (!editingFieldKey) {
      return;
    }
    setStructuredText((prev) => ({
      ...prev,
      [editingFieldKey]: beforeEditStructuredText[editingFieldKey] || '',
    }));
    setEditingFieldKey(null);
  };

  const handleStructuredSave = () => {
    setBeforeEditStructuredText(structuredText);
    setEditingFieldKey(null);
    onTextChange(structuredText);
  };

  const handleStructuredReset = () => {
    const nextText = isStructuredValue(defaultText)
      ? { ...defaultText }
      : Object.keys(structuredText).reduce((acc, key) => {
          acc[key] = '';
          return acc;
        }, {} as StructuredTextValue);
    setStructuredText(nextText);
    setBeforeEditStructuredText(nextText);
    setEditingFieldKey(null);
    onTextChange(nextText);
  };

  const autoHeight = (fieldKey?: string) => {
    const el = fieldKey ? textareaRefs.current[fieldKey] : textareaRef.current;
    if (!el) return;
    if (el.scrollHeight < 200) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    } else {
      el.style.height = '200px';
    }
  };

  useEffect(() => {
    autoHeight();
  }, []);

  useEffect(() => {
    autoHeight();
  }, [isEditing]);

  useEffect(() => {
    if (editingFieldKey) {
      autoHeight(editingFieldKey);
    }
  }, [editingFieldKey, structuredText]);

  if (isStructuredMode) {
    return (
      <div className={styles.container}>
        <div className={styles.title}>{title}</div>
        <div className={styles.structuredList}>
          {Object.entries(structuredText).map(([fieldKey, fieldValue]) => {
            const isFieldEditing = editingFieldKey === fieldKey;
            return (
              <div key={fieldKey} className={styles.structuredItem}>
                <div className={styles.fieldTitle}>
                  {fieldTitles?.[fieldKey] || fieldKey}
                </div>
                <div
                  className={`${styles.contentInnerBox} ${
                    isFieldEditing ? styles.contentBoxEditing : ''
                  }`}
                >
                  {!isFieldEditing && (
                    <div
                      className={styles.contentLabel}
                      style={{
                        maxHeight: `${STRUCTURED_MAX_PREVIEW_LINES * 20}px`,
                      }}
                    >
                      {fieldValue}
                    </div>
                  )}
                  {isFieldEditing ? (
                    <>
                      <div className={styles.editTextareaWrap}>
                        <textarea
                          ref={(element) => {
                            textareaRefs.current[fieldKey] = element;
                          }}
                          style={{
                            maxHeight: `${STRUCTURED_MAX_PREVIEW_LINES * 20}px`,
                          }}
                          className={styles.editTextarea}
                          value={fieldValue}
                          onChange={(e) =>
                            setStructuredText((prev) => ({
                              ...prev,
                              [fieldKey]: e.target.value,
                            }))
                          }
                          placeholder="请输入..."
                          onInput={() => autoHeight(fieldKey)}
                        />
                      </div>
                      <div className={styles.editActions}>
                        <button
                          type="button"
                          className={styles.cancelButton}
                          onClick={handleStructuredCancel}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={handleStructuredSave}
                        >
                          保存
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => handleStructuredEdit(fieldKey)}
                      disabled={Boolean(editingFieldKey)}
                    >
                      编辑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className={styles.extraActionsWrap}>{extraActions}</div>
        </div>
        
        <button
          type="button"
          className={styles.bottomButton}
          onClick={handleStructuredReset}
        >
          <img src={refreshIcon} alt="refresh" className={styles.bottomButtonIcon} />
          <span className={styles.bottomButtonText}>重置</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
      <div className={styles.contentBox}>
        <div
          className={`${styles.contentInnerBox} ${
            isEditing ? styles.contentBoxEditing : ''
          }`}
        >
          {!isEditing && (
            <div
              className={styles.contentLabel}
              style={{ maxHeight: `${DEFAULT_MAX_PREVIEW_LINES * 20}px` }}
            >
              {contentText}
            </div>
          )}
          {isEditing ? (
            <>
              <div className={styles.editTextareaWrap}>
                <textarea
                  ref={textareaRef}
                  className={styles.editTextarea}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="请输入..."
                  onInput={() => autoHeight()}
                />
              </div>
              <div className={styles.editActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCancel}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleSave}
                >
                  保存
                </button>
              </div>
            </>
          ) : (
            <button type="button" className={styles.editButton} onClick={handleEdit}>
              编辑
            </button>
          )}
        </div>
        {extraActions}
      </div>
      <button type="button" className={styles.bottomButton} onClick={handleReset}>
        <img src={refreshIcon} alt="refresh" className={styles.bottomButtonIcon} />
        <span className={styles.bottomButtonText}>重置</span>
      </button>
    </div>
  );
}

export default TextEditPanel;
