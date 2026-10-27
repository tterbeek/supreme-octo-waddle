type ApprovedPhoto = { path:string;owner:string };
type Viewer = { photo:(context:string,photo:string,thumb:boolean)=>Promise<ApprovedPhoto|null>;profile?:(activity:string,author:string)=>Promise<ApprovedPhoto|null>;challenge?:(id:string)=>Promise<ApprovedPhoto|null> };
type MediaDependencies = {
 viewer:(authorization:string)=>Promise<Viewer|null>;
 sign:(bucket:string,path:string,seconds:number)=>Promise<string|null>;
};
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store' };

export function createSocialMediaHandler(dependencies:MediaDependencies) {
 return async(request:Request):Promise<Response>=>{
  const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return respond({error:'Method not allowed'},405);
  try {
   const viewer=await dependencies.viewer(request.headers.get('Authorization')||'');
   if(!viewer)return respond({error:'Sign in required'},401);
   const body=await request.json();
   let approved:ApprovedPhoto|null=null;
   if(typeof body.challenge==='string'&&viewer.challenge)approved=await viewer.challenge(body.challenge);
   else if(typeof body.activity==='string'&&typeof body.author==='string'&&viewer.profile)approved=await viewer.profile(body.activity,body.author);
   else if(typeof body.context==='string'&&typeof body.photo==='string')approved=await viewer.photo(body.context,body.photo,body.thumb===true);
   else return respond({error:'Photo unavailable'},400);
   if(!approved)return respond({error:'Photo unavailable'},403);
   let path=approved.path.split('?')[0];
   if(path.startsWith('http')){
    const match=new URL(path).pathname.match(/^\/storage\/v1\/object\/(?:sign|public)\/(?:actvity-notes|activity-notes)\/(.+)$/);
    if(!match)return respond({error:'Photo unavailable'},403);path=decodeURIComponent(match[1]);
   }
   path=path.replace(/^\/?(?:actvity-notes|activity-notes)\//,'');
   if(!path.startsWith(`${approved.owner}/`)||path.split('/').some(part=>part==='..'))return respond({error:'Photo unavailable'},403);
   for(const bucket of ['actvity-notes','activity-notes']){
    const url=await dependencies.sign(bucket,path,60);
    if(url)return respond({url,expires_in:60});
   }
   return respond({error:'Photo unavailable'},404);
  }catch{return respond({error:'Photo unavailable'},400);}
 };
}
