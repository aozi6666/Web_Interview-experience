/**
 * 本地 MCP 服务 API
 */
import { MCP_LOCAL_URL } from '@shared/config';
import { createHttpClient } from './httpClient';
import { McpExecuteRequest, McpToolsResponse } from '../../utils/mcpPraseTool';

const mcpInstance = createHttpClient({ baseURL: MCP_LOCAL_URL });

export const getMcpTools = async (): Promise<{ data: McpToolsResponse }> => {
  const res = await mcpInstance.get<McpToolsResponse>('/mcp/tools');
  return res;
};

export const postMcpTool = async (data: McpExecuteRequest) => {
  const res = await mcpInstance.post('/mcp/execute', data);
  return res;
};

export const sendChatMcp = async (data: {
  message: string;
  session_id: string;
  enable_gui: boolean;
  timeout: number;
}) => {
  const res = await mcpInstance.post('/gui/chat/stream', data);
  return res;
};

export const sendChatMcpNew = async (data: {
  instruction: string;
  max_steps: number;
}) => {
  const res = await mcpInstance.post('/execute', data);
  return res;
};
