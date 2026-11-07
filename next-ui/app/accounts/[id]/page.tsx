import RelayApp from "@/components/relay-app";
import { demoAccounts } from "@/lib/demo-data";

export function generateStaticParams() {
  return demoAccounts.map(({ id }) => ({ id }));
}

export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RelayApp screen="detail" accountId={id}/>}
