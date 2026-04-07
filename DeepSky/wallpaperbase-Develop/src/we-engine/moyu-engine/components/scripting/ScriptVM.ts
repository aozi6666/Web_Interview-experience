export function compileScriptFactory<TEnv, TResult>(code: string): (env: TEnv) => TResult {
  // eslint-disable-next-line no-new-func
  return new Function('__env', code) as (env: TEnv) => TResult;
}
