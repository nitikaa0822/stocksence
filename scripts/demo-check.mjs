import assert from 'node:assert/strict';

const base=process.argv[2]||'http://localhost:5173';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('Demo verification is limited to the local preview.');
const login=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const read=async()=>{const r=await fetch(base+'/api/inventory',{headers:{cookie}});assert.equal(r.status,200);return r.json();};
async function post(action,data,expected=200){const r=await fetch(base+'/api/inventory',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify({action,data})});const body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return body;}
let inventory=await read();
if(inventory.products.some(p=>p.sku==='DEMO-STEEL-77')){console.log('Demo product already exists; no records changed.');process.exit(0);}
const main=inventory.locations.find(l=>l.name==='Main store');
const rack=inventory.locations.find(l=>l.name==='Production rack');
assert.ok(main&&rack,'Load the sample warehouse before running this optional demo.');
await post('product',{name:'Demo steel — verified flow',sku:'DEMO-STEEL-77',category:'Demo materials',unit:'kg',reorder:10000,target:100000});
inventory=await read();const product=inventory.products.find(p=>p.sku==='DEMO-STEEL-77');assert.ok(product);
async function document(kind,qty,sourceId,destId,expectedQty=null,note='End-to-end demo verification'){
 const id=crypto.randomUUID();await post('operation',{id,kind,sourceId,destId,partner:'Demo workshop',note,lines:[{productId:product.id,qty,expectedQty}]});
 if(kind==='delivery'){await post('delivery-step',{id,step:'pick'});await post('delivery-step',{id,step:'pick'});await post('delivery-step',{id,step:'pack'});}else{await post('transition',{id,status:'Ready'});}return id;
}
const receipt=await document('receipt',100000,null,main.id);await post('transition',{id:receipt,status:'Done'});await post('transition',{id:receipt,status:'Done'});
const transfer=await document('transfer',40000,main.id,rack.id);await post('transition',{id:transfer,status:'Done'});
const delivery=await document('delivery',20000,main.id,null);await post('transition',{id:delivery,status:'Done'});
const count=await document('adjustment',37000,main.id,null,40000,'3 kg damaged during handling');await post('transition',{id:count,status:'Done'});
const unavailable=await document('delivery',1000000,main.id,null);await post('transition',{id:unavailable,status:'Done'},409);await post('transition',{id:unavailable,status:'Canceled'});
const after=await read();
const stock=after.balances.filter(b=>b.product_id===product.id);
assert.equal(stock.reduce((sum,b)=>sum+b.qty,0),77000);
assert.equal(stock.find(b=>b.location_id===main.id).qty,37000);
assert.equal(stock.find(b=>b.location_id===rack.id).qty,40000);
assert.equal(after.movements.filter(m=>m.product_id===product.id).length,5);
assert.equal(after.operations.find(o=>o.id===unavailable).status,'Canceled');
console.log('PASS: real API receipt → transfer → delivery → adjustment = 77 kg (37 Main store + 40 Production rack). Duplicate validation was harmless; insufficient stock returned 409 with no partial movement. Dedicated demo product retained for rehearsal.');
