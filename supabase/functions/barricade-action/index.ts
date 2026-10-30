import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {applyAction} from "./rules.js";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://bpsbeast.github.io","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return response(405,{error:"Método não permitido"});
 try{
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return response(401,{error:"Inicia sessão"});
  const body=await req.json(),code=String(body?.code||"").trim().toUpperCase();
  if(!/^[A-F0-9]{8}$/.test(code))return response(400,{error:"Código inválido"});
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return response(503,{error:"Serviço indisponível"});
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:who,error:authError}=await client.auth.getUser(token);
  if(authError||!who?.user)return response(401,{error:"Sessão inválida"});
  const {data:room,error:readError}=await client.from("barricade_rooms").select("*").eq("code",code).maybeSingle();
  if(readError||!room)return response(404,{error:"Sala não encontrada ou sem acesso"});
  const uid=who.user.id;
  if(uid!==room.white_id&&uid!==room.black_id)return response(403,{error:"Não podes jogar nesta sala"});
  if(room.status!=="active")return response(409,{error:"A partida não está ativa"});
  const color=uid===room.white_id?"r":"b";
  if(body.action!=="resign"&&body.action!=="move"&&body.action!=="wall")return response(400,{error:"Ação inválida"});
  if(body.action!=="resign"&&color!==room.turn)return response(409,{error:"Não é a tua vez"});
  if(!Number.isInteger(body.expected_ply)||body.expected_ply!==room.ply)return response(409,{error:"Jogada desatualizada. Tenta novamente"});
  let next;
  if(body.action==="resign"){
   next={...room,ply:room.ply+1,status:color==="r"?"black_win":"white_win",moves:[...room.moves,{type:"resign",color,ply:room.ply+1}]};
  }else{
   const state={...room,walls:room.walls||[],moves:room.moves||[]};
   const action=body.action==="move"?{type:"move",to:body.to}:{type:"wall",r:body.r,c:body.c,o:body.o};
   try{next=applyAction(state,action)}catch(e){return response(400,{error:e.message||"Jogada ilegal"})}
  }
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const payload={red_pos:next.red_pos,blue_pos:next.blue_pos,red_walls:next.red_walls,blue_walls:next.blue_walls,
   walls:next.walls,moves:next.moves,turn:next.turn,ply:next.ply,status:next.status,
   finish_reason:body.action==="resign"?"resignation":next.status==="draw"?"move_limit":next.status!=="active"?"goal":null,updated_at:new Date().toISOString()};
  const {data:saved,error:saveError}=await admin.from("barricade_rooms").update(payload)
   .eq("id",room.id).eq("ply",room.ply).eq("status","active").select("ply,status").maybeSingle();
  if(saveError){console.error("barricade",saveError);return response(500,{error:"Não foi possível guardar a jogada"})}
  if(!saved)return response(409,{error:"A partida mudou entretanto. Tenta novamente"});
  return response(200,{ok:true,ply:saved.ply,status:saved.status});
 }catch(error){console.error("barricade action",error);return response(500,{error:"Erro ao processar a jogada"})}
});