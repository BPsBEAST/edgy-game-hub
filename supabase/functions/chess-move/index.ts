import { Chess } from "npm:chess.js@1.4.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const ORIGIN = "https://bpsbeast.github.io";
const HEADERS = {"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
const respond=(status:number, body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
 if(req.method!=="POST")return respond(405,{error:"Método não permitido"});
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"Inicia sessão para jogar"});
 try{
  const payload=await req.json();
  const {code,from,to,promotion}=payload||{};
  if(typeof code!=="string"||!/^[0-9A-Fa-f]{8}$/.test(code)||
     typeof from!=="string"||!/^[a-h][1-8]$/.test(from)||
     typeof to!=="string"||!/^[a-h][1-8]$/.test(to)||
     (promotion!==undefined&&!/^[qrbn]$/.test(promotion)))
     return respond(400,{error:"Jogada inválida"});
  const url=Deno.env.get("SUPABASE_URL"),publicKey=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!publicKey||!secret)return respond(503,{error:"Servidor indisponível"});
  const player=createClient(url,publicKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const user=await player.auth.getUser(token);
  if(user.error||!user.data.user)return respond(401,{error:"Sessão inválida"});
  const {data:room,error:roomError}=await player.from("chess_rooms").select("*").eq("code",code.toUpperCase()).maybeSingle();
  if(roomError||!room)return respond(404,{error:"Sala não encontrada ou sem acesso"});
  if(room.status!=="active"||!room.black_id)return respond(409,{error:"A partida não está ativa"});
  const color=room.white_id===user.data.user.id?"w":room.black_id===user.data.user.id?"b":null;
  if(!color)return respond(403,{error:"Não és participante desta partida"});
  if(room.turn!==color)return respond(409,{error:"Não é a tua vez"});
  const chess=new Chess();
  if(room.pgn)chess.loadPgn(room.pgn);
  if(chess.fen()!==room.fen)return respond(409,{error:"O estado da partida precisa de ser sincronizado"});
  let move;
  try{move=chess.move({from,to,...(promotion?{promotion}:{})});}catch{return respond(400,{error:"Jogada ilegal"});}
  if(!move)return respond(400,{error:"Jogada ilegal"});
  let status="active";
  if(chess.isCheckmate())status=color==="w"?"white_win":"black_win";
  else if(chess.isDraw())status="draw";
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const {data:committed,error:commitError}=await admin.rpc("edgy_chess_commit",{
   p_room_id:room.id,p_expected_ply:room.ply,p_new_fen:chess.fen(),p_new_pgn:chess.pgn(),p_next_turn:chess.turn(),
   p_last_move:move.from+move.to+(move.promotion||""),p_status:status
  });
  if(commitError){console.error("chess commit",commitError);return respond(500,{error:"Não foi possível guardar a jogada"});}
  if(!committed)return respond(409,{error:"A partida foi atualizada. Volta a tentar."});
  return respond(200,{ok:true,status,ply:room.ply+1});
 }catch(error){console.error("chess request",error);return respond(500,{error:"Erro ao processar jogada"})}
});