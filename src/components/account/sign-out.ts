export async function signOutAccount(dependencies:{request:typeof fetch;navigate:(path:string)=>void}){
 const {request}=dependencies;
 let response;
 try{response=await request('/api/v1/auth/logout',{method:'POST',signal:AbortSignal.timeout(20000)});}catch{throw new Error('Could not confirm sign-out. Check your connection and try again.');}
 let body;try{body=await response.json();}catch{throw new Error('Could not confirm sign-out. Please try again.');}
 if(!response.ok||body.data?.signedOut!==true)throw new Error('You could not be signed out. Please try again.');
 dependencies.navigate('/login');
}
