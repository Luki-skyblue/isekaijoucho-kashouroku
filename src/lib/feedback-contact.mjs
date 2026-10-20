// Owner approved this fallback address on 2026-10-20. No automatic mail sending.
export const APPROVED_FEEDBACK_EMAIL='lukiluki0118@gmail.com';
export function feedbackFormUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\\]/.test(value))return null;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  if(u.hostname==='forms.gle'&&/^\/[A-Za-z0-9_-]+$/.test(u.pathname))return u.toString();
  if(u.hostname==='docs.google.com'&&/^\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform$/.test(u.pathname))return u.toString();
 }catch{/* Invalid addresses never become public links. */}return null;
}
export function feedbackContact(env={}){
 const raw=env.KASHOUROKU_VERIFIED_FEEDBACK_EMAIL??APPROVED_FEEDBACK_EMAIL;
 const email=typeof raw==='string'&&raw.length<=254&&/^[^\s@<>,:;]+@[^\s@<>,:;]+\.[A-Za-z]{2,}$/.test(raw)?raw:null;
 return {email,formUrl:feedbackFormUrl(env.KASHOUROKU_FEEDBACK_FORM_URL)};
}
export function configuredFeedbackContact(){return feedbackContact({
 KASHOUROKU_VERIFIED_FEEDBACK_EMAIL:process.env.KASHOUROKU_VERIFIED_FEEDBACK_EMAIL,
 KASHOUROKU_FEEDBACK_FORM_URL:process.env.KASHOUROKU_FEEDBACK_FORM_URL
});}
