export function validCreatorKey(value:unknown):boolean;
export function validCreditRole(value:unknown):boolean;
export function readCreditQuery(creator:unknown,role:unknown):{creatorKey:string;creditRole:string};
export function validFirstDate(value:unknown):boolean;
export function readFirstRange(from:unknown,to:unknown):{firstFrom:string;firstTo:string;dateError:string|null};
