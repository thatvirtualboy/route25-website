const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHandler } = require('../api/embed');
const embeds = require('../lib/embeds');
const config = require('../vercel.json');
const token = 'test-share-token-with-enough-length';
const trainer = { id:'trainer1', displayName:'A <collector>', avatarURL:'javascript:alert(1)', level:12, ownedCardCount:135, followers:8, completedTradeCount:3 };
const payload = {ok:true,owner:trainer,collection:{trainerId:'trainer1',cardCount:135,totalOwnedCopies:136,value:{totalValue:11146.33,pricedCardCount:133}},cards:Array.from({length:20},(_,i)=>({id:`base1-${i}`,name:i===0 ? '<script>alert(1)</script>' : `Card ${i}`,quantity:1,sortPrice:20-i,images:{small:'https://images.pokemontcg.io/base1/1.png'}}))};
function capture(){return{statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v},end(v=''){this.body=v}}}

test('framing exception is limited to widget paths, not admin, login or full share pages',()=>{
 const rule = config.headers.find(r=>r.headers.some(h=>h.key==='Content-Security-Policy'));
 const match = new RegExp(`^${rule.source}$`);
 for(const path of ['/','/embed','/embed/','/newsletter/admin','/login','/web/profile','/trainer/trainer1','/collection/trainer1','/embed/trainer/x/extra','/api/embed.js']) assert.ok(match.test(path),path);
 for(const path of ['/embed/trainer/trainer1','/embed/collection/trainer1','/embed/collection/trainer1/']) assert.ok(!match.test(path),path);
 assert.match(rule.headers[0].value,/frame-ancestors 'none'/);
 assert.match(rule.headers[0].value,/frame-src 'self'/);
 assert.match(embeds.EMBED_CSP,/frame-ancestors http: https:/);
 assert.match(embeds.EMBED_CSP,/default-src 'none'/);
 for(const kind of ['trainer','collection']) assert.ok(config.rewrites.some(r=>r.source===`/embed/${kind}/:id` && r.destination===`/api/embed.js?kind=${kind}&id=:id`));
});

test('profile projection cannot expose account data or private collection access',()=>{
 const projected = embeds.publicTrainer('trainer1',{displayName:'Collector',avatarSprite:'trainerRed',trainer:{level:12,xp:1000},followers:['a','b'],ownedCardCount:135,completedTradeCount:3,email:'private@example.com',collectionShareToken:token,collectionValue:{totalValue:11146.33},tradeCenterProfile:{address:'private'}});
 assert.equal(projected.followers,2);assert.equal(projected.level,12);
 for(const secret of ['private@example.com',token,'11146.33','private']) assert.ok(!JSON.stringify(projected).includes(secret));
 assert.deepEqual(embeds.PUBLIC_PROFILE_FIELDS,['displayName','avatarSprite','trainer.level','ownedCardCount','completedTradeCount','followers']);
 assert.equal(embeds.safeImage('https://evil.test/a.png'),'');assert.equal(embeds.safeImage('javascript:alert(1)'),'');
});

test('rendered widgets are escaped, responsive, read-only and open links outside the frame',()=>{
 const opts=embeds.options({kind:'collection',id:'trainer1',token,theme:'light'});
 const html=embeds.renderCollection(payload,opts);
 assert.match(html,/\$11,146\.33/);assert.match(html,/Showing 12 of 135/);assert.equal((html.match(/class="widget-card"/g)||[]).length,12);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.doesNotMatch(html,/<script|<form|javascript:|window.location/);
 assert.match(html,/data-theme="light"/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 const hidden=embeds.renderCollection(payload,{...opts,showValue:false});assert.doesNotMatch(hidden,/11,146|11146|Estimated value/);
 const empty=embeds.renderCollection({...payload,cards:[],collection:{cardCount:0,totalOwnedCopies:0} },opts);assert.match(empty,/No cards/);assert.doesNotMatch(empty,/NaN/);
 assert.doesNotMatch(embeds.renderTrainer(trainer,{id:'trainer1',theme:'dark'}),/<script|javascript:|<form/);
});

test('handler rejects missing tokens and writes before performing reads; HEAD has no body',async()=>{
 let reads=0;
 const handler=createHandler({loadTrainer:async()=>{reads++;return trainer},loadCollection:async()=>{reads++;return payload}});
 for(const query of [{kind:'collection',id:'trainer1'},{kind:'collection',id:'trainer1',token:'short'},{kind:'admin',id:'trainer1'},{kind:'trainer',id:'../private'},{kind:'trainer',id:['a','b']}]){
  const res=capture();await handler({method:'GET',query},res);assert.equal(res.statusCode,404);
 }
 assert.equal(reads,0);
 const post=capture();await handler({method:'POST',query:{kind:'trainer',id:'trainer1'}},post);assert.equal(post.statusCode,405);assert.equal(reads,0);
 const head=capture();await handler({method:'HEAD',query:{kind:'trainer',id:'trainer1'}},head);assert.equal(head.statusCode,200);assert.equal(head.body,'');
 const res=capture();await handler({method:'GET',query:{kind:'collection',id:'trainer1',token}},res);
 assert.equal(res.statusCode,200);assert.match(res.headers['content-security-policy'],/frame-ancestors http: https:/);
 assert.equal(res.headers['referrer-policy'],'no-referrer');assert.equal(res.headers['cache-control'],'private, no-store');assert.equal(res.headers['set-cookie'],undefined);
});

test('unavailable or revoked shares remain unavailable; operational errors do not leak details',async()=>{
 const missing=createHandler({loadCollection:async()=>null});const res=capture();await missing({method:'GET',query:{kind:'collection',id:'trainer1',token}},res);assert.equal(res.statusCode,404);
 const broken=createHandler({loadTrainer:async()=>{throw new Error('secret credential')}});const err=capture();await broken({method:'GET',query:{kind:'trainer',id:'trainer1'}},err);assert.equal(err.statusCode,503);assert.doesNotMatch(err.body,/secret credential/);
});

test('collection reads require backend authorization and never forward visitor credentials',async()=>{
 const original=global.fetch;let requested;
 try{
  global.fetch=async(url,init)=>{requested={url:new URL(url),init};return{ok:true,status:200,json:async()=>payload}};
  assert.equal((await embeds.loadCollection({id:'trainer1',token})).collection.value.totalValue,11146.33);
  assert.equal(requested.url.pathname,'/collection/trainer1');assert.equal(requested.url.searchParams.get('token'),token);assert.equal(requested.url.searchParams.get('format'),'json');
  assert.equal(requested.init.headers.cookie,undefined);assert.equal(requested.init.headers.authorization,undefined);assert.equal(requested.init.redirect,'error');
  global.fetch=async()=>({status:404});assert.equal(await embeds.loadCollection({id:'trainer1',token}),null);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({...payload,collection:{trainerId:'other'}})});await assert.rejects(embeds.loadCollection({id:'trainer1',token}),/Invalid collection/);
 }finally{global.fetch=original}
});

test('builder generates portable code and rejects unrelated or incomplete links',async()=>{
 const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{value:'',checked:true,hidden:true,textContent:'',events:{},addEventListener(k,fn){this.events[k]=fn},removeAttribute(k){delete this[k]},focus(){},select(){}});return elements.get(id)}
 let copied='';const context={document:{querySelector:element},URL,navigator:{clipboard:{writeText:async text=>{copied=text}}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/embed-builder.js'),'utf8'),context);
 const submit=()=>element('#embed-form').events.submit({preventDefault(){}});
 element('#embed-theme').value='light';element('#share-link').value=`https://route25.app/collection/trainer1?token=${token}`;submit();
 assert.equal(element('#embed-result').hidden,false);assert.match(element('#embed-code').value,/https:\/\/route25.app\/embed\/collection\/trainer1/);assert.match(element('#embed-code').value,/&amp;theme=light/);
 assert.equal(element('#embed-preview').height,700);await element('#copy-code').events.click();assert.equal(copied,element('#embed-code').value);
 element('#show-value').checked=false;submit();assert.match(element('#embed-code').value,/value=0/);
 element('#share-link').value='https://route25.app/trainer/trainer1';submit();assert.equal(element('#embed-preview').height,320);assert.doesNotMatch(element('#embed-code').value,/token=/);
 for(const url of ['https://evil.test/trainer/id','https://route25.app@evil.test/trainer/id','https://route25.app/collection/id','https://route25.app/login']){element('#share-link').value=url;submit();assert.equal(element('#embed-result').hidden,true);assert.ok(element('#embed-error').textContent)}
});
