import RelayApp from "@/components/relay-app";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RelayApp screen="detail" accountId={id}/>}
