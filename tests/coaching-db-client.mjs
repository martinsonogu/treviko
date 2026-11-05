// Minimal test-only PostgREST adapter. Executes real SQL/RLS; never contacts Supabase.
export function sqlClient(db,userId=null,admin=false){
 function normalise(value,key=''){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(v=>normalise(v));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalise(v,k)]));if(typeof value==='string'&&['amount_per_100g','grams','servings','height_cm','weight_kg','weekly_budget'].includes(key))return Number(value);return value;}
 async function execute(work){try{return await db.transaction(async tx=>{await tx.exec(`set local role ${admin?'service_role':'authenticated'}`);if(userId)await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[userId]);return await work(tx);});}catch(error){return {data:null,error:{message:error.message}};}}
 const identifier=value=>{if(!/^[a-z_]+$/.test(value))throw new Error('Bad test identifier');return value;};
 return {
  rpc(name,args){return execute(async tx=>{const entries=Object.entries(args);const result=await tx.query(`select public.${identifier(name)}(${entries.map(([key],i)=>`${identifier(key)} => $${i+1}`).join(',')}) as result`,entries.map(([,value])=>value&&typeof value==='object'&&!Array.isArray(value)?JSON.stringify(value):value));return {data:result.rows[0].result,error:null};});},
  from(table){identifier(table);let mode='select',values=null,projection='*',single=false;const filters=[],orders=[];let count=null;
   const builder={select(columns='*'){projection=columns;return builder;},insert(value){mode='insert';values=value;return builder;},update(value){mode='update';values=value;return builder;},delete(){mode='delete';return builder;},eq(key,value){filters.push([identifier(key),'=',value]);return builder;},gt(key,value){filters.push([identifier(key),'>',value]);return builder;},order(key,{ascending=true}={}){orders.push(`${identifier(key)} ${ascending?'asc':'desc'}`);return builder;},limit(value){count=value;return builder;},single(){single=true;return builder;},maybeSingle(){single=true;return builder;},then(resolve,reject){return execute(async tx=>{
    const params=[];const bind=value=>{params.push(value&&typeof value==='object'&&!Array.isArray(value)?JSON.stringify(value):value);return '$'+params.length;};
    const where=()=>filters.length?' where '+filters.map(([k,op,v])=>`${k}${op}${bind(v)}`).join(' and '):'';
    let sql;
    if(mode==='select'){
     let columns=projection;
     if(projection.includes('food_nutrients('))columns=`${table}.*,(select coalesce(jsonb_agg(n.*),'[]') from public.food_nutrients n where n.food_id=${table}.id) as food_nutrients`;
     if(projection.includes('recipe_ingredients('))columns=`${table}.*,(select coalesce(jsonb_agg(n.*),'[]') from public.recipe_ingredients n where n.recipe_id=${table}.id) as recipe_ingredients`;
     if(projection.includes('nutrition_plan_references('))columns=`${table}.*,(select coalesce(jsonb_agg(n.*),'[]') from public.nutrition_plan_references n where n.plan_id=${table}.id) as nutrition_plan_references`;
     sql=`select ${columns} from public.${table}${where()}${orders.length?' order by '+orders.join(','):''}${count!==null?' limit '+Number(count):''}`;
    }else if(mode==='insert'){const entries=Object.entries(values);sql=`insert into public.${table}(${entries.map(([k])=>identifier(k)).join(',')}) values(${entries.map(([,v])=>bind(v)).join(',')}) returning *`;}
    else if(mode==='update'){sql=`update public.${table} set ${Object.entries(values).map(([k,v])=>identifier(k)+'='+bind(v)).join(',')}${where()} returning *`;}
    else sql=`delete from public.${table}${where()} returning *`;
    const result=await tx.query(sql,params);return {data:normalise(single?result.rows[0]??null:result.rows),error:null};
   }).then(resolve,reject);}};return builder;
  },
 };
}
