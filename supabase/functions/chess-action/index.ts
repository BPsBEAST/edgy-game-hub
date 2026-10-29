import {Chess} from "npm:chess.js@1.4.0";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const allowedOrigin="https://bpsbeast.github.io";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
function response(status:number,body:Record<string,unknown>){return new Response(JSON.stringify(body),{status,headers})}
Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return response(405,{error:"Método não permitido"});
 const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return response(401,{error:"Inicia sessão"});
 try{
  const payload=await request.json(),code=payload?.code,action=payload?.action;
  if(typeof code!=="string"||!/^[0-9A-F]{8}$/i.test(code))return response(400,{error:"Código inválido"});
  if(!["move","tick","resign","offer_draw","accept_draw","decline_draw"].includes(action))
   return response(400,{error:"Ação desconhecida"});
  const url=Deno.env.get("SUPABASE_URL"),publicKey=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!publicKey||!secret)return response(503,{error:"Servidor indisponível"});
  const publicClient=createClient(url,publicKey,{global:{headers:{"Authorization":"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await publicClient.auth.getUser(token);
  if(authError||!authData.user)return response(401,{error:"Sessão inválida"});
  const uid=authData.user.id;
  const {data:room,error:roomError}=await publicClient.from("chess_rooms").select("*").eq("code",code.toUpperCase()).maybeSingle();
  if(roomError||!room)return response(404,{error:"Sala não encontrada ou sem acesso"});
  if(uid!==room.white_id&&uid!==room.black_id)return response(403,{error:"Acesso não autorizado"});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(action!=="move"){
   const rpc=action==="tick"?"edgy_chess_tick":"edgy_chess_player_action";
   const args=action==="tick"?{p_room_id:room.id}:{p_room_id:room.id,p_actor:uid,p_action:action};
   const {data,error}=await admin.rpc(rpc,args);
   if(error){console.error("Chess action",error.message);return response(500,{error:"Não foi possível atualizar a partida"})}
   return response(data?.ok?200:409,{...data});
  }
  if(room.status!=="active"||!room.black_id)return response(409,{error:"Partida não está ativa"});
  const color=room.white_id===uid?"w":"b";
  if(room.turn!==color)return response(409,{error:"Ainda não é a tua vez"});
  const {from,to,promotion}=payload;
  if(typeof from!=="string"||!/^[a-h][1-8]$/.test(from)||typeof to!=="string"||!/^[a-h][1-8]$/.test(to)||
     (promotion!==undefined&&(typeof promotion!=="string"||!/^[qrbn]$/.test(promotion))))
   return response(400,{error:"Movimento inválido"});
  const chess=new Chess();
  if(room.pgn)chess.loadPgn(room.pgn);
  if(chess.fen()!==room.fen)return response(409,{error:"Posição desatualizada"});
  let move;
  try{move=chess.move({from,to,...(promotion?{promotion}:{})})}catch{return response(400,{error:"Jogada ilegal"})}
  if(!move)return response(400,{error:"Jogada ilegal"});
  let status="active";
  if(chess.isCheckmate())status=color==="w"?"white_win":"black_win";
  else if(chess.isDraw())status="draw";
  const {data,error}=await admin.rpc("edgy_chess_commit_timed",{
   p_room_id:room.id,p_actor:uid,p_expected_ply:room.ply,
   p_new_fen:chess.fen(),p_new_pgn:chess.pgn(),p_next_turn:chess.turn(),
   p_last_move:move.from+move.to+(move.promotion||""),p_status:status
  });
  if(error){console.error("Chess move commit",error.message);return response(500,{error:"Não foi possível guardar a jogada"})}
  if(!data?.ok)return response(409,{...data,error:data?.reason==="timeout"?"O teu tempo terminou.": "Partida atualizada, sincroniza e tenta novamente."});
  return response(200,{...data,move:move.san});
 }catch(error){console.error("Chess request",error);return response(500,{error:"Erro ao processar pedido"})}
});