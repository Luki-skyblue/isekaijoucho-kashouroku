export function creditRoleLabel(role:string):string;
export function canonicalCreditRole(role:string):string;
export function creditRoleSourceLabel(role:string):string;
export function creditRoleSearchTerms(role:string):string[];
export const CREDIT_ROLE_GROUPS:{id:string;label:string;aliases:string[]}[];
export function orderedCreditRoles(roles:Iterable<string>):string[];
export function songCreditRole(detail:Record<string,unknown>|null|undefined,credit:{role:string;scope?:string}):string;
