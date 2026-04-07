import { LoggerCore } from './core/LoggerCore';

/** 主进程日志实例，写入 {logs}/{YYYY-MM-DD}/main.log */
const logMain = new LoggerCore('main.log');

export default logMain;
