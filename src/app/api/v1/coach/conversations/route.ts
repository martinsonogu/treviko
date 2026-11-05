import {privateRoute,readJson} from '@/lib/api/http';
import {listConversations,createConversation,conversationSchema} from '@/lib/persistence/conversations';
export const GET=privateRoute(async(_r,c)=>listConversations(c));
export const POST=privateRoute(async(r,c)=>createConversation(c,(await readJson(r,conversationSchema)).title));
