export type Activity = { id:string; type:string; summary:string; when:string; source?:string };
export type Contact = { id?:string; name:string; title:string; email:string; status:string };
export type Deal = { name:string; stage:string; value:number; nextStep:string };
export type Account = { id:string; company:string; domain:string; industry:string; initials:string; color:string; summary:string; sourceNotes:string; contact:Contact; deal:Deal; activities:Activity[]; sequenceStatus:string; handoff?:string };
export type SequenceStep = { delay:number; subject:string; body:string; rationale:string };
export type Sequence = { id?:string; accountId:string; status:"draft"|"approved"; rationale:string; steps:SequenceStep[] };
export type Handoff = { id?:string; accountId:string; company:string; contact:string; reason:string; due:string; status:"open"|"done" };
