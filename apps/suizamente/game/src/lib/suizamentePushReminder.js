export const PUSH_REMINDER_DELAY=3*24*60*60*1000
const key=owner=>'suizamente:push-recordatorio:'+owner
export function pushReminderDue(owner,now=Date.now(),storage=localStorage){
 if(!owner)return false
 try{const value=Number(storage.getItem(key(owner)));return !Number.isFinite(value)||value<=now}catch{return true}
}
export function postponePushReminder(owner,now=Date.now(),storage=localStorage){
 if(!owner)return
 try{storage.setItem(key(owner),String(now+PUSH_REMINDER_DELAY))}catch{/* The modal still closes if storage is unavailable. */}
}
