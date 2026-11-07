import { NextResponse } from "next/server";
import { SequenceSchema } from "@/lib/schemas";
import { createDemoSequence,demoSequences } from "@/lib/demo-data";
import type { Account } from "@/lib/types";
export async function POST(req:Request){
 const body=await req.json();const id=String(body.accountId||"");const fallback=body.account?createDemoSequence({...body.account,id} as Account):(demoSequences[id]||demoSequences.northstar);
 if(process.env.ANTHROPIC_API_KEY&&body.account){try{
  const response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||"claude-haiku-4-5-20251001",max_tokens:1600,system:"Create a concise email-first outreach sequence using only supplied account facts. Return only valid JSON with keys accountId,status,rationale,steps. status must be draft. Each step has delay (integer days), subject, body, rationale. Do not invent researched facts. Include exactly three steps.",messages:[{role:"user",content:JSON.stringify({accountId:id,account:body.account})}]})});
  if(response.ok){const payload=await response.json();const raw=payload.content?.find((x:any)=>x.type==="text")?.text;const obj=JSON.parse(raw);const checked=SequenceSchema.safeParse(obj);if(checked.success)return NextResponse.json({sequence:checked.data,mode:"model",label:"AI draft · based on supplied account context"});}
 }catch{/* Use the deterministic demo path if the provider is unavailable or returns invalid JSON. */}}
 const parsed=SequenceSchema.safeParse({...fallback,status:"draft",accountId:id||fallback.accountId});if(!parsed.success)return NextResponse.json({error:"Sequence output did not match the expected format."},{status:422});return NextResponse.json({sequence:parsed.data,mode:"demo_fixture",label:"Demo plan · based on supplied account context"});
}
