export async function deleteAccount(values:{password:string;confirmation:string},dependencies:{request:typeof fetch;clearCredentials:()=>void;navigate:(path:string)=>void}){
 let response;try{response=await dependencies.request('/api/v1/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(values),signal:AbortSignal.timeout(30000)});}catch{throw new Error('Could not confirm the deletion result. Reload your account before retrying.');}
 let body;try{body=await response.json();}catch{throw new Error('Could not confirm the deletion result. Reload your account before retrying.');}
 if(!response.ok)throw new Error(body.error?.code==='REAUTH_REQUIRED'?'We couldn’t verify your current password. Check it and try again.':'Your account deletion could not be completed. Please try again later.');
 if(body.data?.deleted!==true)throw new Error('Deletion could not be confirmed. Reload your account before retrying.');
 dependencies.clearCredentials();dependencies.navigate('/login?deleted=true');
}
