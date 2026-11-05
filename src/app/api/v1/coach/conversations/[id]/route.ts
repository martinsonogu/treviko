import {privateRoute,readJson} from '@/lib/api/http';
import {getConversation,deleteConversation,renameConversation,conversationSchema} from '@/lib/persistence/conversations';
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){const {id}=await c.params;return privateRoute(async(_r,user)=>getConversation(user,id))(r);}
export async function DELETE(r:Request,c:Context){const {id}=await c.params;return privateRoute(async(_r,user)=>deleteConversation(user,id))(r);}
export async function PATCH(r:Request,c:Context){const {id}=await c.params;return privateRoute(async(r,user)=>renameConversation(user,id,(await readJson(r,conversationSchema)).title))(r);}
