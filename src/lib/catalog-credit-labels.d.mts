export function creditRoleLabel(role:string):string;
export function orderedCreditRoles(roles:Iterable<string>):string[];
export function songCreditRole(detail:Record<string,unknown>|null|undefined,credit:{role:string;scope?:string}):string;
