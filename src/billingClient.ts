export async function billingFetch(path:string,body?:unknown,method='POST'):Promise<Record<string,unknown>> {
  const response=await fetch(path,{method:body===undefined?'GET':method,cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();if(!response.ok)throw new Error(result.message??'Deze handeling kon niet worden uitgevoerd.');return result;
}
