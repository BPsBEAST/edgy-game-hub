import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {applyMove} from "./rules.js";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://bpsbeast.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const output=(code,body)=>new Response(JSON.stringify(body),{status:code,headers});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return output(405,{error:"Método não permitido"});
 try{
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return output(401,{error:"Inicia sessão para jogar"});
  const body=await req.json(),roomCode=String(body?.code||"").toUpperCase();
  if(!/^[A-F0-9]{8}$/.test(roomCode))return output(400,{error:"Código de sala inválido"});
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return output(503,{error:"Serviço indisponível"});
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:who,error:authError}=await client.auth.getUser(token);
  if(authError||!who?.user)return output(401,{error:"Sessão inválida"});
  const {data:room,error:readError}=await client.from("checkers_rooms").select("*").eq("code",roomCode).maybeSingle();
  if(readError||!room)return output(404,{error:"Sala não encontrada ou sem acesso"});
  const uid=who.user.id;if(uid!==room.white_id&&uid!==room.black_id)return output(403,{error:"Sem acesso"});
  if(room.status!=="active")return output(409,{error:"A partida não está ativa"});
  const seat=room.white_id===uid?"w":"b";
  const action=body?.action;
  if(action!=="resign"&&action!=="move")return output(400,{error:"Ação inválida"});
  if(action==="move"&&seat!==room.turn)return output(409,{error:"Não é a tua vez"});
  let next;
  if(action==="resign"){
   next={board:room.board,turn:room.turn,ply:room.ply+1,status:seat==="w"?"black_win":"white_win",last:room.last_move||[],history:room.moves||[],quiet:room.quiet||0};
  }else{
   const path=body?.path;
   if(!Array.isArray(path)||path.length<2||path.length>13||!path.every(x=>Number.isInteger(x)&&x>=0&&x<64))return output(400,{error:"Caminho inválido"});
   const state={board:room.board,turn:room.turn,ply:room.ply,status:"active",history:room.moves||[],last:room.last_move||[],quiet:room.quiet||0};
   try{next=applyMove(state,path)}catch{return output(400,{error:"Jogada ilegal. Verifica as capturas obrigatórias."})}
  }
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const payload={board:next.board,turn:next.turn,ply:next.ply,moves:next.history,last_move:next.last,quiet:next.quiet,
    status:next.status,finish_reason:action==="resign"?"resignation":next.status==="draw"?"no_progress":next.status!=="active"?"no_moves":null,
    updated_at:new Date().toISOString()};
  const {data:saved,error:saveError}=await admin.from("checkers_rooms").update(payload).eq("id",room.id).eq("ply",room.ply).eq("status","active").select("id,ply,status").maybeSingle();
  if(saveError){console.error(saveError.message);return output(500,{error:"Não foi possível guardar a jogada"})}
  if(!saved)return output(409,{error:"Partida já foi atualizada. Sincroniza e tenta novamente."});
  return output(200,{ok:true,ply:saved.ply,status:saved.status});
 }catch(error){console.error("checkers",error);return output(500,{error:"Erro ao processar a jogada"})}
});