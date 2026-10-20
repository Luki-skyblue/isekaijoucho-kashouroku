export function createOwnerGateway(options?: {
  env?: Record<string,string|undefined>;
  now?: ()=>number;
  bodyTimeoutMs?: number;
}): (request: Request)=>Promise<Response>;
export function ownerPageEnabled(headers: Pick<Headers,'get'|'has'>, options?: {
  env?: Record<string,string|undefined>; now?: ()=>number;
}): boolean;
