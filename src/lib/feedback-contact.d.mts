export const APPROVED_FEEDBACK_EMAIL:string;
export const APPROVED_FEEDBACK_FORM_URL:string;
export function feedbackFormUrl(value:unknown):string|null;
export function feedbackContact(env?:Record<string,string|undefined>):{email:string|null;formUrl:string|null};
export function configuredFeedbackContact():{email:string|null;formUrl:string|null};
