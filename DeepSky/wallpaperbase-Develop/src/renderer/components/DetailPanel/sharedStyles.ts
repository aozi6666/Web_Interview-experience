export const panelTitleStyles = `
  position: absolute;
  top: 24px;
  left: 24px;
  font-size: 24px;
  line-height: 24px;
  color: #fff;
`;

export const bottomButtonStyles = `
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 84px;
  height: 32px;
  border-radius: 16px;
  background: rgba(25, 200, 200, 1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
`;

export const bottomButtonIconStyles = `
  font-size: 14px;
  line-height: 1;
  color: rgba(16, 18, 17, 1);
`;

export const bottomButtonTextStyles = `
  font-size: 12px;
  line-height: 1;
  color: rgba(16, 18, 17, 1);
`;

export const scrollAreaStyles = `
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(91, 98, 95, 1) rgba(55, 59, 57, 1);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(55, 59, 57, 1);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(91, 98, 95, 1);
    border-radius: 999px;
  }
`;

export const editButtonStyles = `
  width: 80px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(68, 73, 71, 1);
  box-sizing: border-box;
  background: rgba(32, 34, 34, 1);
  color: #fff;
  cursor: pointer;
`;

export const editTextareaStyles = `
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  resize: none;
  color: rgba(236, 238, 237, 1);
  font-size: 14px;
  line-height: 1.5;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
`;

export const editActionsStyles = `
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
`;
