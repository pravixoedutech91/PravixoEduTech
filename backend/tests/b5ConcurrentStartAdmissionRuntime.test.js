"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const vm = require("node:vm");
const path = require("node:path");
const code = fs.readFileSync(path.join(__dirname,"../src/controllers/studentMockTestController.js"),"utf8");
const start = code.slice(code.indexOf("const startMockTestAttempt = async"),code.indexOf("// Read-only, ownership-checked state refresh"));
const number = code.slice(code.indexOf("const getNextAttemptNumber = async"),code.indexOf("const getOrCreateAttemptDetail = async"));
const S="507f1f77bcf86cd799439011", T="507f1f77bcf86cd799439012", V="507f1f77bcf86cd799439013";
const dual={policyVersion:1,allowedModes:["practice","exam_simulation"]};
function fixture(o={}) {
 const state={attempts:[],details:[],locks:new Map(),closed:0,transactions:0,guardWrites:0,guardConflicts:o.guardConflicts||0,failDetail:!!o.failDetail};
 const mock={_id:T,activeVersionId:V,accessType:o.accessType||"free"};
 const version={_id:V,accessType:"free",settings:{maxAttempts:o.maxAttempts||1,experiencePolicy:o.policy===undefined?dual:o.policy},sections:[]};
 const query=(fn)=>({
   then(ok,bad){return Promise.resolve().then(fn).then(ok,bad)},
   session(){return Promise.resolve().then(fn)},
   sort(){return this}, select(){return this}
 });
 const MockTest={findOne:()=>query(()=>mock)};
 const MockTestVersion={findOne:()=>query(()=>version)};
 const TestAttempt={
  findOne(q){return query(()=>{
   const a=state.attempts.filter(a=>a.tenantId==='tenant'&&a.studentId===S&&a.mockTestId===T);
   if(q.status)return a.find(v=>v.status===q.status&&v.isActive)||null;
   return a.sort((x,y)=>y.attemptNumber-x.attemptNumber)[0]||null;
  })},
  countDocuments(q){return query(()=>state.attempts.filter(a=>a.tenantId==='tenant'&&a.studentId===S&&a.mockTestId===T&&a.isActive&&(
    typeof q.status==='string'?a.status===q.status:q.status.$in.includes(a.status)
  )).length)},
  async create([doc],options){assert.ok(options.session);const attempt={...doc,_id:'a'+(state.attempts.length+1),isActive:true,async save(p){assert.ok(p.session)}};state.attempts.push(attempt);return [attempt]}
 };
 const TestAttemptDetail={async create([doc],options){assert.ok(options.session);if(state.failDetail)throw new Error('INJECTED_DETAIL_FAILURE');const detail={...doc,_id:'d'+(state.details.length+1)};state.details.push(detail);return [detail]}};
 const Guard={
   makeKey({tenantId,studentId,mockTestId}){return crypto.createHash('sha256').update(JSON.stringify([tenantId,studentId,mockTestId].map(String))).digest('hex')},
   async updateOne(q,body,opts){assert.ok(opts.session);assert.equal(opts.upsert,true);assert.equal(body.$inc.revision,1);
     if(state.guardConflicts-->0){const e=new Error('INJECTED_DUPLICATE_GUARD');e.code=11000;throw e}
     const previous=state.locks.get(q._id)||Promise.resolve();let unlock;
     const next=new Promise(resolve=>{unlock=resolve});state.locks.set(q._id,next);
     await previous;opts.session.unlock=unlock;state.guardWrites++;
   }
 };
 const mongoose={Types:{ObjectId:{isValid:()=>true}},async startSession(){
   return {unlock:null,async withTransaction(fn){state.transactions++;
     const beforeA=state.attempts.length,beforeD=state.details.length;
     try{
       const result=await fn();
       if(o.unknownCommit){const e=new Error('UNKNOWN_COMMIT');e.hasErrorLabel=name=>name==='UnknownTransactionCommitResult';throw e}
       return result;
     }catch(e){if(!o.unknownCommit){state.attempts.length=beforeA;state.details.length=beforeD}throw e}
     finally{if(this.unlock){this.unlock();this.unlock=null}}
   },async endSession(){state.closed++}}
 }};
 const mode=(policy,selected)=>{
   if(policy===undefined)return {valid:selected===undefined,mode:undefined,message:'Legacy mode not selectable'};
   if(selected===undefined&&policy.allowedModes.length===1)return {valid:true,mode:policy.allowedModes[0]};
   return {valid:policy.allowedModes.includes(selected),mode:selected,message:'Invalid selection'};
 };
 const env={
   mongoose,TestAttempt,TestAttemptDetail,TestAttemptAdmissionGuard:Guard,MockTest,MockTestVersion,
   getStudentTenantId:req=>req.user.tenantId,
   hasActiveMockTestEntitlement:async()=>o.entitled!==false,
   resolveNewAttemptExperience:mode,
   validateResumeExperience:(saved,given)=>({valid:given===undefined||saved===given,message:'Mode cannot change'}),
   resolveAttemptTimingState:()=>({attemptExpired:false}),
   getOrCreateAttemptDetail:async(_tenant,a,_version,session)=>{assert.ok(session);return state.details.find(d=>d.attemptId===a._id)},
   calculateTotalDurationSeconds:()=>1800,toNumber:(n,d)=>Number(n)||d,
   buildAttemptTimingState:({experienceMode})=>({mode:experienceMode==='practice'?'global':'sectional'}),
   calculateTotalQuestions:()=>0,calculateMaxScore:()=>0,buildInitialAnswersFromVersion:()=>[],
   getInProgressDetailExpiresAt:d=>d,
   buildAttemptPayload:(a,_v,resumed,d)=>({attempt:{_id:a._id,experienceMode:a.experienceMode},resumed,detailId:d?._id}),
   REVIEW_RETENTION_DAYS:7,logRuntimeError:()=>{},getInternalErrorMessage:()=>"INTERNAL_ERROR",
   Date,Error,Promise,Object,Number
 };
 vm.createContext(env);
 vm.runInContext(number+'\n'+start+'\nthis.start=startMockTestAttempt;',env);
 async function request(experienceMode){const req={params:{mockTestId:T},user:{_id:S,tenantId:'tenant'},body:experienceMode===undefined?{}:{experienceMode}};
   const res={statusCode:200,body:null,status(n){this.statusCode=n;return this},json(b){this.body=b;return this}};
   await env.start(req,res);return res;
 }
 return {state,request};
}
test('B5 concurrent ten compatible starts create one attempt and nine resumes',async()=>{
 const {request,state}=fixture();const results=await Promise.all(Array.from({length:10},()=>request('practice')));
 assert.equal(results.filter(r=>r.statusCode===201).length,1);
 assert.equal(results.filter(r=>r.statusCode===200).length,9);
 assert.equal(state.attempts.length,1);assert.equal(state.details.length,1);assert.equal(state.closed,10);
});
test('B5 two incompatible concurrent modes create only one attempt',async()=>{
 const {request,state}=fixture();const responses=await Promise.all([request('practice'),request('exam_simulation')]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[201,409]);assert.equal(state.attempts.length,1);
});
test('B5 quota one blocks later retake across modes',async()=>{
 const {request,state}=fixture();assert.equal((await request('practice')).statusCode,201);
 state.attempts[0].status='submitted';assert.equal((await request('exam_simulation')).statusCode,403);
 assert.equal(state.attempts.length,1);
});
test('B5 injected detail failure rolls back and closes session',async()=>{
 const {request,state}=fixture({failDetail:true});assert.equal((await request('practice')).statusCode,500);
 assert.equal(state.attempts.length,0);assert.equal(state.details.length,0);assert.equal(state.closed,1);
});
test('B5 first guard upsert collision is retried with bound',async()=>{
 const {request,state}=fixture({guardConflicts:1});assert.equal((await request('practice')).statusCode,201);
 assert.equal(state.attempts.length,1);assert.equal(state.closed,1);
});
test('B5 repeated guard collisions fail closed',async()=>{
 const {request,state}=fixture({guardConflicts:3});assert.equal((await request('practice')).statusCode,409);
 assert.equal(state.attempts.length,0);assert.equal(state.closed,1);
});
test('B5 paid access gate denies before session',async()=>{
 const {request,state}=fixture({accessType:'paid',entitled:false});assert.equal((await request('practice')).statusCode,403);
 assert.equal(state.closed,0);assert.equal(state.guardWrites,0);
});
test('B5 denied published policy does not create attempt',async()=>{
 const {request,state}=fixture({policy:{policyVersion:1,allowedModes:['exam_simulation']}});
 assert.equal((await request('practice')).statusCode,400);assert.equal(state.attempts.length,0);
});

test('B5 ambiguous commit returns conflict and does not retry logical create',async()=>{
 const {request,state}=fixture({unknownCommit:true});assert.equal((await request('practice')).statusCode,409);
 assert.equal(state.attempts.length,1);assert.equal(state.details.length,1);assert.equal(state.transactions,1);
});
